import { qboApiClient } from '../api.client';
import { qboAuthService } from '../auth.service';
import { QboQueryResponse, QboCustomer } from '../types';

export class QboCustomerService {
  public async getCustomers(limit = 10): Promise<QboCustomer[]> {
    const { realmId } = await qboAuthService.getValidAccessToken();
    const query = `select * from Customer maxresults ${limit}`;
    const response = await qboApiClient.get<QboQueryResponse<QboCustomer>>(
      `/v3/company/${realmId}/query`,
      { query }
    );
    return response.QueryResponse.Customer ?? [];
  }
}

export const qboCustomerService = new QboCustomerService();
