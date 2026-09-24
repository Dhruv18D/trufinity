import { Router } from 'express';
import { reportingService } from './reporting.service';

const router = Router();

// Full dashboard snapshot in one call — invoices, payments, and data-quality metrics.
router.get('/summary', async (_req, res, next) => {
  try {
    const data = await reportingService.getSnapshot();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// Invoice KPIs: totals, AR outstanding, paid/unpaid/partially-paid breakdown.
router.get('/invoices/summary', async (_req, res, next) => {
  try {
    const data = await reportingService.getInvoiceSummary();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// Payment KPIs: totals, applied/unapplied amounts, reconciliation status.
router.get('/payments/summary', async (_req, res, next) => {
  try {
    const data = await reportingService.getPaymentSummary();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// Sync/data-quality health per entity (Customer/Invoice/Payment): raw vs. mapped counts, broken links.
router.get('/completeness', async (_req, res, next) => {
  try {
    const data = await reportingService.getQboCompleteness();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// ServiceTitan <-> QuickBooks customer identity match quality.
router.get('/customer-identity-quality', async (_req, res, next) => {
  try {
    const data = await reportingService.getCustomerIdentityQuality();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// Payment-to-invoice application integrity: orphans, duplicates, stale identities.
router.get('/payment-application-integrity', async (_req, res, next) => {
  try {
    const data = await reportingService.getPaymentApplicationIntegrity();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

export const reportingRouter = router;
