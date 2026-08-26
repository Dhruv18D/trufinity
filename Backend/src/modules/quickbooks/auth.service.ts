import { env } from '../../config/env';
import { logger } from '../../utils/logger';

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

class QboAuthService {
  private tokenSet: QboTokenSet | null = null;
  private EXPIRY_BUFFER_MS = 60 * 1000;

  public getAuthorizationUrl(): string {
    const scope = encodeURIComponent('com.intuit.quickbooks.accounting');
    const redirectUri = encodeURIComponent(env.QBO_REDIRECT_URI);
    const state = 'security_token_' + Math.random().toString(36).substring(7); // Basic CSRF protection mock
    
    return `${env.QBO_AUTH_URL}?client_id=${env.QBO_CLIENT_ID}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
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
      const errorText = await response.text();
      logger.error('[QuickBooks] Token exchange failed', { status: response.status, errorText });
      throw new Error(`Failed to exchange code: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.saveTokenSet(data, realmId);
  }

  public async refreshAccessToken(): Promise<void> {
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
      const errorText = await response.text();
      logger.error('[QuickBooks] Token refresh failed', { status: response.status, errorText });
      this.clearCache(); // Force re-auth
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.saveTokenSet(data, this.tokenSet.realmId);
  }

  public async getValidAccessToken(): Promise<{ accessToken: string, realmId: string }> {
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
  private saveTokenSet(data: TokenResponse, realmId: string): void {
    const now = Date.now();
    this.tokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      realmId: realmId,
      accessTokenExpiry: now + (data.expires_in * 1000),
      refreshTokenExpiry: now + (data.x_refresh_token_expires_in * 1000)
    };
    logger.info('[QuickBooks] Tokens saved successfully (in-memory)');
  }

  public clearCache(): void {
    this.tokenSet = null;
  }
}

export const qboAuthService = new QboAuthService();
