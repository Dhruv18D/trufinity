/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { db } from '../../database';
import { randomBytes } from 'node:crypto';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

export interface QboTokenSet {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

export interface QboTokenStore {
  save(tokens: QboTokenSet): Promise<void>;
  load(): Promise<QboTokenSet | null>;
  clear(): Promise<void>;
}

class PostgresQboTokenStore implements QboTokenStore {
  public async save(tokens: QboTokenSet): Promise<void> {
    await db('qbo_oauth_tokens').insert({ realm_id: tokens.realmId, access_token: tokens.accessToken, refresh_token: tokens.refreshToken, access_token_expiry: tokens.accessTokenExpiry, refresh_token_expiry: tokens.refreshTokenExpiry }).onConflict('realm_id').merge({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken, access_token_expiry: tokens.accessTokenExpiry, refresh_token_expiry: tokens.refreshTokenExpiry, updated_at: db.fn.now() });
  }
  public async load(): Promise<QboTokenSet | null> {
    const row = await db('qbo_oauth_tokens').orderBy('updated_at', 'desc').first();
    if (!row) return null;
    return { accessToken: String(row.access_token), refreshToken: String(row.refresh_token), realmId: String(row.realm_id), accessTokenExpiry: Number(row.access_token_expiry), refreshTokenExpiry: Number(row.refresh_token_expiry) };
  }
  public async clear(): Promise<void> { await db('qbo_oauth_tokens').delete(); }
}

export class QboAuthService {
  private tokenSet: QboTokenSet | null = null;
  private readonly pendingStates = new Map<string, number>();
  private refreshInFlight: Promise<void> | null = null;
  public constructor(private readonly tokenStore: QboTokenStore = new PostgresQboTokenStore()) {}
  private EXPIRY_BUFFER_MS = 60 * 1000;
  private OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

  public getAuthorizationUrl(): string {
    const scope = encodeURIComponent('com.intuit.quickbooks.accounting');
    const redirectUri = encodeURIComponent(env.QBO_REDIRECT_URI);
    const state = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.OAUTH_STATE_TTL_MS;
    this.removeExpiredStates();
    this.pendingStates.set(state, expiresAt);
    
    return `${env.QBO_AUTH_URL}?client_id=${env.QBO_CLIENT_ID}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
  }

  public consumeAuthorizationState(state: string): boolean {
    const expiresAt = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    return typeof expiresAt === 'number' && expiresAt > Date.now();
  }

  public async disconnect(): Promise<boolean> {
    const stored = await this.tokenStore.load();
    if (!stored) {
      this.tokenSet = null;
      return false;
    }

    const authHeader = Buffer.from(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(env.QBO_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
      body: new URLSearchParams({ token: stored.refreshToken }),
    });

    if (!response.ok) {
      await response.text();
      logger.error('[QuickBooks] Token revocation failed', { status: response.status });
      throw new Error('QuickBooks disconnect failed.');
    }

    this.tokenSet = null;
    await this.tokenStore.clear();
    logger.info('[QuickBooks] QuickBooks connection disconnected');
    return true;
  }

  public async exchangeCodeForToken(code: string, realmId: string): Promise<void> {
    logger.info('[QuickBooks] Exchanging authorization code for tokens');
    
    const authHeader = Buffer.from(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(env.QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.QBO_REDIRECT_URI
      })
    });

    if (!response.ok) {
      await response.text();
      logger.error('[QuickBooks] Token exchange failed', { status: response.status });
      throw new Error(`Failed to exchange code: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    await this.saveTokenSet(data, realmId);
  }

  public async refreshAccessToken(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const refreshOperation = this.performAccessTokenRefresh();
    this.refreshInFlight = refreshOperation;
    try {
      await refreshOperation;
    } finally {
      if (this.refreshInFlight === refreshOperation) this.refreshInFlight = null;
    }
  }

  private async performAccessTokenRefresh(): Promise<void> {
    if (!this.tokenSet?.refreshToken) {
      throw new Error('No refresh token available. User must re-authorize.');
    }

    logger.info('[QuickBooks] Refreshing access token');
    const authHeader = Buffer.from(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(env.QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokenSet.refreshToken
      })
    });

    if (!response.ok) {
      await response.text();
      logger.error('[QuickBooks] Token refresh failed', { status: response.status });
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    await this.saveTokenSet(data, this.tokenSet.realmId);
  }

  public async getValidAccessToken(): Promise<{ accessToken: string, realmId: string }> {
    this.tokenSet ??= await this.tokenStore.load();
    if (!this.tokenSet) {
      throw new Error('QuickBooks is not authenticated. Please authorize first.');
    }

    const now = Date.now();
    
    // Check if access token is expired or about to expire
    if (now > this.tokenSet.accessTokenExpiry - this.EXPIRY_BUFFER_MS) {
      await this.refreshAccessToken();
    }

    // Ensure we have a valid token set after potential refresh
    if (!this.tokenSet) {
      throw new Error('QuickBooks authentication failed during token refresh.');
    }

    return {
      accessToken: this.tokenSet.accessToken,
      realmId: this.tokenSet.realmId
    };
  }

  // Encapsulated setter to allow easy migration to DB later
  private async saveTokenSet(data: TokenResponse, realmId: string): Promise<void> {
    const now = Date.now();
    const updatedTokenSet: QboTokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      realmId: realmId,
      accessTokenExpiry: now + (data.expires_in * 1000),
      refreshTokenExpiry: now + (data.x_refresh_token_expires_in * 1000)
    };
    await this.tokenStore.save(updatedTokenSet);
    this.tokenSet = updatedTokenSet;
    logger.info('[QuickBooks] Token state saved securely');
  }

  public async clearCache(): Promise<void> {
    this.tokenSet = null;
    await this.tokenStore.clear();
  }

  private removeExpiredStates(): void {
    const now = Date.now();
    for (const [state, expiresAt] of this.pendingStates.entries()) {
      if (expiresAt <= now) this.pendingStates.delete(state);
    }
  }
}

export const qboAuthService = new QboAuthService();
