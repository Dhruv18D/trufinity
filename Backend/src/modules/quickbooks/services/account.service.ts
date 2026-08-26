import { qboApiClient } from '../api.client';
import { qboAuthService } from '../auth.service';
import { QboQueryResponse, QboAccount } from '../types';

export class QboAccountService {
  public async getAccounts(limit = 10): Promise<QboAccount[]> {
    const { realmId } = await qboAuthService.getValidAccessToken();
    const query = `select * from Account maxresults ${limit}`;
    const response = await qboApiClient.get<QboQueryResponse<QboAccount>>(
      `/v3/company/${realmId}/query`,
      { query }
    );
    return response.QueryResponse.Account ?? [];
  }
}

export const qboAccountService = new QboAccountService();
