import { EmptyState, ErrorState, SkeletonTable } from "@/components/ui/States";
import { AlertRow } from "@/components/alerts/AlertRow";
import { listAlerts, type DetectedAlert } from "@/lib/api/alerts";
import { getRuleMeta } from "@/lib/rules";

/** D-series alerts (D-01 booking rate decline, D-06 objection spike). */
export async function DemandAlerts({ ruleCode, limit }: { ruleCode?: string; limit?: number }) {
  let alerts: DetectedAlert[];
  try {
    alerts = await listAlerts(ruleCode);
  } catch {
    return <ErrorState title="Couldn't load demand alerts" />;
  }

  const demand = alerts.filter((a) => getRuleMeta(a.rule_code).section === "demand");
  const shown = limit ? demand.slice(0, limit) : demand;

  if (shown.length === 0) {
    return (
      <EmptyState
        icon="check-circle"
        title="No demand alerts"
        description={ruleCode ? `No ${ruleCode} exceptions detected.` : "No booking-rate or objection exceptions detected."}
      />
    );
  }

  return (
    <div className="-mx-5 divide-y divide-border-subtle sm:-mx-6">
      {shown.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

export function DemandAlertsSkeleton() {
  return <SkeletonTable rows={3} />;
}
