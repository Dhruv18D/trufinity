import { formatDecimal, formatMoney, formatRatio } from "./format";

// Single lookup for rule codes (spec Section 5). New codes (F-*, E-*, O-*, R-*, M-*, P-*) get added here only.

export type RuleSeverity = "red" | "amber" | "blue";
export type RuleSection = "demand" | "escalations" | "redFlags" | "watchList" | "opportunities" | "responsiveness" | "marketing";
/** How metric_value / baseline_value should be displayed. */
export type MetricFormat = "ratio" | "count" | "money" | "number";

export interface RuleMeta {
  code: string;
  label: string;
  section: RuleSection;
  severity: RuleSeverity;
  metricLabel: string;
  metricFormat: MetricFormat;
}

export const rules: Record<string, RuleMeta> = {
  "D-01": {
    code: "D-01",
    label: "Booking rate decline",
    section: "demand",
    severity: "amber",
    metricLabel: "Booking rate",
    metricFormat: "ratio",
  },
  "D-06": {
    code: "D-06",
    label: "Objection category spike",
    section: "demand",
    severity: "amber",
    metricLabel: "Objection rate",
    metricFormat: "ratio",
  },
};

export function getRuleMeta(code: string): RuleMeta {
  return (
    rules[code] ?? {
      code,
      label: code,
      section: "watchList",
      severity: "amber",
      metricLabel: "Metric",
      metricFormat: "number",
    }
  );
}

export function rulesForSection(section: RuleSection): RuleMeta[] {
  return Object.values(rules).filter((r) => r.section === section);
}

export const severityStyles: Record<RuleSeverity, string> = {
  red: "bg-danger-soft text-danger",
  amber: "bg-warning-soft text-warning",
  blue: "bg-teal-light text-teal-dark",
};

/** Dimension values that are not a person/entity name. */
export function formatDimension(dimension: string): string {
  return dimension === "TENANT_TOTAL" ? "All CSRs (company total)" : dimension;
}

export function formatMetric(value: string | null, format: MetricFormat): string {
  switch (format) {
    case "ratio":
      return formatRatio(value);
    case "money":
      return formatMoney(value);
    default:
      return formatDecimal(value);
  }
}
