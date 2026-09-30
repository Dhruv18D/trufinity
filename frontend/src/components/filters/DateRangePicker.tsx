"use client";

import { useState } from "react";
import {
  DATE_PRESETS,
  dateParamKeys,
  matchPreset,
  presetRange,
  todayIso,
  type DatePresetId,
  type DateRange,
} from "@/lib/filters";
import { useUrlParams } from "./useUrlParams";

export const filterControlClass =
  "rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition focus:border-teal-dark/50 focus:outline-none disabled:opacity-60";

/**
 * Shared date filter for summary cards. Writes `${prefix}From` / `${prefix}To` to the URL;
 * the "This month" preset clears both, which the backend treats as month-to-date.
 */
export function DateRangePicker({ prefix, range }: { prefix: string; range: DateRange }) {
  const keys = dateParamKeys(prefix);
  const { setParams, isPending } = useUrlParams();
  const today = todayIso();
  const [customOpen, setCustomOpen] = useState(false);
  const preset: DatePresetId = customOpen ? "custom" : matchPreset(range, today);

  // Custom inputs start from the applied range, or the MTD bounds when none is set.
  const from = range.from ?? `${today.slice(0, 8)}01`;
  const to = range.to ?? today;

  const apply = (next: DateRange) => setParams({ [keys.from]: next.from, [keys.to]: next.to });

  const onPreset = (id: DatePresetId) => {
    if (id === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    apply(presetRange(id, today));
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isPending ? "opacity-70" : ""}`} aria-busy={isPending}>
      <select
        aria-label="Date range"
        className={filterControlClass}
        value={preset}
        onChange={(e) => onPreset(e.target.value as DatePresetId)}
      >
        {DATE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {preset === "custom" && (
        <>
          <input
            type="date"
            aria-label="From date"
            className={filterControlClass}
            value={from}
            max={to}
            onChange={(e) => e.target.value && e.target.value <= to && apply({ from: e.target.value, to })}
          />
          <span className="text-xs text-foreground/45">to</span>
          <input
            type="date"
            aria-label="To date"
            className={filterControlClass}
            value={to}
            min={from}
            max={today}
            onChange={(e) => e.target.value && e.target.value >= from && apply({ from, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
