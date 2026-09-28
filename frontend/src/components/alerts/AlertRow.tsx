import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { DetectedAlert } from "@/lib/api/alerts";
import { formatDateTime } from "@/lib/format";
import { formatDimension, formatMetric, getRuleMeta, severityStyles } from "@/lib/rules";

export function RuleBadge({ code }: { code: string }) {
  const meta = getRuleMeta(code);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityStyles[meta.severity]}`}>
      {code}
    </span>
  );
}

/** Narrative is pre-validated by the backend; when missing, fall back to the raw numbers. */
export function alertSummary(alert: DetectedAlert): string {
  if (alert.narrative) return alert.narrative;
  const meta = getRuleMeta(alert.rule_code);
  return `${meta.metricLabel}: ${formatMetric(alert.metric_value, meta.metricFormat)} vs. baseline ${formatMetric(
    alert.baseline_value,
    meta.metricFormat,
  )}`;
}

export function AlertRow({ alert }: { alert: DetectedAlert }) {
  const meta = getRuleMeta(alert.rule_code);
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="flex items-start gap-4 px-5 py-4 transition hover:bg-surface-muted/50 sm:px-6"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <RuleBadge code={alert.rule_code} />
          <span className="text-sm font-medium text-foreground">{meta.label}</span>
          <span className="text-xs text-foreground/45">· {formatDimension(alert.dimension)}</span>
        </div>
        <p className="text-sm text-foreground/70">{alertSummary(alert)}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-foreground/45">
          <span>
            {meta.metricLabel} {formatMetric(alert.metric_value, meta.metricFormat)} · baseline{" "}
            {formatMetric(alert.baseline_value, meta.metricFormat)}
          </span>
          <span>Detected {formatDateTime(alert.detected_at)} PT</span>
          {!alert.narrative && <span className="italic">Narrative pending</span>}
        </div>
      </div>
      <Icon name="chevron-right" className="mt-1 h-4 w-4 shrink-0 text-foreground/30" />
    </Link>
  );
}
