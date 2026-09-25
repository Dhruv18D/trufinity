import { cache } from "react";
import { apiGet } from "./client";

/** Money values arrive as decimal strings, e.g. "12345.67". Format with formatMoney, never parse. */
export type DecimalString = string;

export interface InvoiceSummary {
  totalActiveInvoices: number;
  paidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  zeroValueCount: number;
  unsupportedCount: number;
  invoiceTotal: DecimalString;
  outstandingAr: DecimalString;
  totalTax: DecimalString;
  totalDiscount: DecimalString;
  brokenTargetCount: number;
}

export interface PaymentSummary {
  paymentCount: number;
  paymentTotal: DecimalString;
  unappliedTotal: DecimalString;
  mappedApplicationTotal: DecimalString;
  reconciledPaymentCount: number;
  unreconciledPaymentCount: number;
  netReconciliationDifference: DecimalString;
  paymentsWithoutInvoiceApplications: number;
}

export interface EntityCompleteness {
  latestNonDeletedRawCount: number;
  activeIdentityCount: number;
  unifiedTargetCount: number;
  brokenTargetCount: number;
  duplicateSourceIdentityCount: number;
  mappingErrorCount: number;
}

export interface QboCompleteness {
  Customer: EntityCompleteness;
  Invoice: EntityCompleteness;
  Payment: EntityCompleteness;
}

export interface CustomerIdentityQuality {
  serviceTitanCustomerIdentityCount: number;
  verifiedTierACount: number;
  unresolvedCount: number;
  mergedCount: number;
  brokenUnifiedTargetCount: number;
  tierAWithoutSharedQboTarget: number;
  unresolvedSharingQboTarget: number;
}

export interface PaymentApplicationIntegrity {
  totalApplicationRows: number;
  orphanPaymentReferences: number;
  orphanInvoiceReferences: number;
  duplicatePaymentInvoicePairs: number;
  applicationsWithInactiveOrDeletedQboIdentity: number;
}

export interface QuickbooksSummary {
  invoices: InvoiceSummary;
  payments: PaymentSummary;
  qboCompleteness: QboCompleteness;
  customerIdentityQuality: CustomerIdentityQuality;
  paymentApplicationIntegrity: PaymentApplicationIntegrity;
}

const BASE = "/api/reporting/quickbooks";

// Combined call for the dashboard's initial load; memoized per request.
export const getQuickbooksSummary = cache(() => apiGet<QuickbooksSummary>(`${BASE}/summary`));

export const getInvoiceSummary = () => apiGet<InvoiceSummary>(`${BASE}/invoices/summary`);
export const getPaymentSummary = () => apiGet<PaymentSummary>(`${BASE}/payments/summary`);
export const getQboCompleteness = () => apiGet<QboCompleteness>(`${BASE}/completeness`);
export const getCustomerIdentityQuality = () =>
  apiGet<CustomerIdentityQuality>(`${BASE}/customer-identity-quality`);
export const getPaymentApplicationIntegrity = () =>
  apiGet<PaymentApplicationIntegrity>(`${BASE}/payment-application-integrity`);
