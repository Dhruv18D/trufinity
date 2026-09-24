import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, SkeletonCard } from "@/components/ui/States";
import { getQuickbooksSummary, type QuickbooksSummary } from "@/lib/api/reporting";
import { formatCount, formatMoney } from "@/lib/format";
import { MetricTile, issueTone } from "./MetricTile";

export async function FinancialOverview() {
  let summary: QuickbooksSummary;
  try {
    summary = await getQuickbooksSummary();
  } catch {
    return (
      <ErrorState
        title="Couldn't load financial overview"
        description="The QuickBooks reporting API didn't respond. Refresh the page to try again."
      />
    );
  }
  const { invoices, payments } = summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard metric={{ id: "active", label: "Active Invoices", value: formatCount(invoices.totalActiveInvoices) }} />
        <StatCard metric={{ id: "total", label: "Invoice Total", value: formatMoney(invoices.invoiceTotal) }} />
        <StatCard metric={{ id: "ar", label: "Outstanding AR", value: formatMoney(invoices.outstandingAr) }} />
        <StatCard metric={{ id: "tax", label: "Total Tax", value: formatMoney(invoices.totalTax) }} />
        <StatCard metric={{ id: "discount", label: "Total Discount", value: formatMoney(invoices.totalDiscount) }} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoice Status" subtitle="Active QuickBooks invoices by payment status" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricTile label="Paid" value={formatCount(invoices.paidCount)} tone="success" />
            <MetricTile label="Partially Paid" value={formatCount(invoices.partiallyPaidCount)} tone="warning" />
            <MetricTile label="Unpaid" value={formatCount(invoices.unpaidCount)} tone="danger" />
            <MetricTile label="Zero Value" value={formatCount(invoices.zeroValueCount)} />
            <MetricTile label="Unsupported" value={formatCount(invoices.unsupportedCount)} />
            <MetricTile
              label="Broken Links"
              value={formatCount(invoices.brokenTargetCount)}
              tone={issueTone(invoices.brokenTargetCount)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Payments" subtitle="QuickBooks payments, application and reconciliation" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricTile label="Payments" value={formatCount(payments.paymentCount)} />
            <MetricTile label="Payment Total" value={formatMoney(payments.paymentTotal)} />
            <MetricTile label="Applied to Invoices" value={formatMoney(payments.mappedApplicationTotal)} />
            <MetricTile label="Unapplied" value={formatMoney(payments.unappliedTotal)} />
            <MetricTile label="Reconciled" value={formatCount(payments.reconciledPaymentCount)} tone="success" />
            <MetricTile
              label="Unreconciled"
              value={formatCount(payments.unreconciledPaymentCount)}
              tone={issueTone(payments.unreconciledPaymentCount)}
            />
            <MetricTile label="Net Reconciliation Diff." value={formatMoney(payments.netReconciliationDifference)} />
            <MetricTile
              label="Without Invoice Link"
              value={formatCount(payments.paymentsWithoutInvoiceApplications)}
              tone={issueTone(payments.paymentsWithoutInvoiceApplications)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function FinancialOverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
