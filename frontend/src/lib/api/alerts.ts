import { ApiError, apiGet } from "./client";
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
  /** Fraction for D-01 / D-06 ("0.42" = 42%). */
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
export function listAlerts(ruleCode?: string): Promise<DetectedAlert[]> {
  return apiGet<DetectedAlert[]>(BASE, { ruleCode });
}

/** Null when the alert doesn't exist (backend also 404s for malformed ids). */
export async function getAlert(id: string): Promise<DetectedAlert | null> {
  try {
    return await apiGet<DetectedAlert>(`${BASE}/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
