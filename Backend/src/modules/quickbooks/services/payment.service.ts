import { qboApiClient } from '../api.client';
import { qboAuthService } from '../auth.service';
import { QboQueryResponse, QboPayment } from '../types';

export class QboPaymentService {
  public async getPayments(limit = 10): Promise<QboPayment[]> {
    const { realmId } = await qboAuthService.getValidAccessToken();
    const query = `select * from Payment maxresults ${limit}`;
    const response = await qboApiClient.get<QboQueryResponse<QboPayment>>(
      `/v3/company/${realmId}/query`,
      { query }
    );
    return response.QueryResponse.Payment ?? [];
  }
}

export const qboPaymentService = new QboPaymentService();
