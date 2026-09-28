import { apiGetJson } from "./client";
import type { DecimalString } from "./reporting";

/** One row of the backend `detected_alerts` table (snake_case, as the API returns it). */
export interface DetectedAlert {
  id: string;
  rule_code: string;
  dimension: string;
  period_start: string | null;
  period_end: string | null;
  baseline_start: string | null;
  baseline_end: string | null;
  metric_value: DecimalString | null;
  baseline_value: DecimalString | null;
  details: Record<string, unknown> | null;
  /** Pre-validated LLM sentence; safe to render as plain text. Null until narrated. */
  narrative: string | null;
  narrated_at: string | null;
  detected_at: string;
}

const BASE = "/api/brief/alerts";

/** Newest first. */
export async function listAlerts(ruleCode?: string): Promise<DetectedAlert[]> {
  return (await apiGetJson<DetectedAlert[]>(BASE, { ruleCode })) ?? [];
}

/** Null when the alert doesn't exist. */
export function getAlert(id: string): Promise<DetectedAlert | null> {
  return apiGetJson<DetectedAlert>(`${BASE}/${encodeURIComponent(id)}`);
}
