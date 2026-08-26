import { qboApiClient } from '../api.client';
import { qboAuthService } from '../auth.service';
import { QboQueryResponse, QboInvoice } from '../types';

export class QboInvoiceService {
  public async getInvoices(limit = 10): Promise<QboInvoice[]> {
    const { realmId } = await qboAuthService.getValidAccessToken();
    const query = `select * from Invoice maxresults ${limit}`;
    const response = await qboApiClient.get<QboQueryResponse<QboInvoice>>(
      `/v3/company/${realmId}/query`,
      { query }
    );
    return response.QueryResponse.Invoice ?? [];
  }
}

export const qboInvoiceService = new QboInvoiceService();
