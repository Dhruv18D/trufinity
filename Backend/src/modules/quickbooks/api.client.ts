import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { qboAuthService } from './auth.service';

export class QboApiClient {
  private baseUrl = env.QBO_API_BASE_URL;

  public async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const { accessToken } = await qboAuthService.getValidAccessToken();

    // Construct URL with query parameters
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, String(params[key]));
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('[QuickBooks] Token unauthorized during API call. Clearing cache.');
          // In a more robust system, we could auto-retry the refresh here once.
          void qboAuthService.clearCache();
        }

        await response.text();
        throw new Error(`QuickBooks API Error: [${response.status}]`);
      }

      return (await response.json()) as T;
    } catch (error) {
      const statusMatch = error instanceof Error ? /\[(\d{3})\]/.exec(error.message) : null;
      logger.error(`[QuickBooks] GET ${endpoint} failed`, { status: statusMatch?.[1] });
      throw error;
    }
  }
}

export const qboApiClient = new QboApiClient();
