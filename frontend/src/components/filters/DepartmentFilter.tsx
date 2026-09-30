"use client";

import { DEPARTMENTS, departmentParamKey, type Department } from "@/lib/filters";
import { useUrlParams } from "./useUrlParams";

const OPTIONS: { value?: Department; label: string }[] = [
  { label: "All" },
  ...DEPARTMENTS.map((d) => ({ value: d, label: d })),
];

/** Segmented control over the fixed department list. "All" (the default) sends no department param. */
export function DepartmentFilter({ prefix, value }: { prefix: string; value?: Department }) {
  const { setParams, isPending } = useUrlParams();

  return (
    <div
      role="radiogroup"
      aria-label="Department"
      aria-busy={isPending}
      className={`inline-flex rounded-lg border border-border-subtle bg-surface-muted/60 p-0.5 ${isPending ? "opacity-70" : ""}`}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && setParams({ [departmentParamKey(prefix)]: opt.value })}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              active ? "bg-surface text-foreground shadow-sm" : "text-foreground/55 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
