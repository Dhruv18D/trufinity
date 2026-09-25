import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { FilterChips, Pagination } from "@/components/ui/Pagination";
import {
  listStInvoices,
  ST_INVOICE_CLASSIFICATIONS,
  ST_MAX_PAGE_SIZE,
  type StInvoiceClassification,
  type StInvoiceListItem,
} from "@/lib/api/servicetitan";
import type { Paginated } from "@/lib/api/client";
import { formatDate, formatEnumLabel, formatMoney } from "@/lib/format";

const PAGE_SIZE = 25;
const BASE_PATH = "/field-operations/invoices";

const classificationStyles: Record<StInvoiceClassification, string> = {
  PAID: "bg-success-soft text-success",
  PARTIALLY_PAID: "bg-warning-soft text-warning",
  UNPAID: "bg-danger-soft text-danger",
  ZERO_VALUE: "bg-surface-muted text-foreground/60",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseClassification(value: string | undefined): StInvoiceClassification | undefined {
  const upper = value?.toUpperCase();
  return (ST_INVOICE_CLASSIFICATIONS as readonly string[]).includes(upper ?? "")
    ? (upper as StInvoiceClassification)
    : undefined;
}

export default async function StInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const classification = parseClassification(firstParam(sp.classification));
  const page = Math.max(1, Number(firstParam(sp.page)) || 1);

  let result: Paginated<StInvoiceListItem> | null = null;
  try {
    result = await listStInvoices({ page, pageSize: Math.min(PAGE_SIZE, ST_MAX_PAGE_SIZE), classification });
  } catch {
    result = null;
  }

  return (
    <div>
      <Link href="/field-operations" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-foreground/55 hover:text-foreground">
        <Icon name="arrow-left" className="h-3.5 w-3.5" /> Field Operations
      </Link>
      <PageHeader title="Invoices" description="ServiceTitan invoices. Filter by payment classification to drill down." />

      <FilterChips
        basePath={BASE_PATH}
        param="classification"
        active={classification}
        options={ST_INVOICE_CLASSIFICATIONS.map((c) => ({ value: c, label: formatEnumLabel(c) }))}
      />

      {!result ? (
        <ErrorState title="Couldn't load invoices" />
      ) : result.data.length === 0 ? (
        <EmptyState title="No invoices found" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-foreground/45">
                  <th className="px-5 py-3 font-medium sm:px-6">Invoice #</th>
                  <th className="px-5 py-3 font-medium sm:px-6">Status</th>
                  <th className="px-5 py-3 font-medium sm:px-6">Invoice Date</th>
                  <th className="px-5 py-3 font-medium sm:px-6">Due</th>
                  <th className="px-5 py-3 font-medium sm:px-6">Paid On</th>
                  <th className="px-5 py-3 font-medium sm:px-6">Customer</th>
                  <th className="px-5 py-3 text-right font-medium sm:px-6">Total</th>
                  <th className="px-5 py-3 text-right font-medium sm:px-6">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {result.data.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-5 py-3.5 font-medium text-foreground sm:px-6">{inv.referenceNumber ?? inv.id}</td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classificationStyles[inv.classification]}`}>
                        {formatEnumLabel(inv.classification)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-foreground/60 sm:px-6">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-3.5 text-foreground/60 sm:px-6">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5 text-foreground/60 sm:px-6">{formatDate(inv.paidOn)}</td>
                    <td className="px-5 py-3.5 text-foreground/60 sm:px-6">{inv.customerId ?? "—"}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-foreground/75 sm:px-6">{formatMoney(inv.total)}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-foreground sm:px-6">{formatMoney(inv.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            basePath={BASE_PATH}
            query={{ classification }}
            page={result.page}
            pageSize={result.pageSize}
            totalCount={result.totalCount}
          />
        </Card>
      )}
    </div>
  );
}
