import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/Pagination";
import { DemandAlerts, DemandAlertsSkeleton } from "@/components/sections/DemandAlerts";
import { rulesForSection } from "@/lib/rules";

const BASE_PATH = "/demand-alerts";

export default async function DemandAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).ruleCode;
  const demandRules = rulesForSection("demand");
  const ruleCode = demandRules.find((r) => r.code === (Array.isArray(raw) ? raw[0] : raw))?.code;

  return (
    <div>
      <PageHeader
        title="Demand Alerts"
        description="Booking-rate declines and objection spikes detected from Lace AI call data, newest first."
      />
      <FilterChips
        basePath={BASE_PATH}
        param="ruleCode"
        active={ruleCode}
        options={demandRules.map((r) => ({ value: r.code, label: `${r.code} · ${r.label}` }))}
      />
      <Card>
        <Suspense key={ruleCode ?? "all"} fallback={<DemandAlertsSkeleton />}>
          <DemandAlerts ruleCode={ruleCode} />
        </Suspense>
      </Card>
    </div>
  );
}
