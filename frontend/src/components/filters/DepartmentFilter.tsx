"use client";

import { DEFAULT_DEPARTMENT, DEPARTMENTS, departmentParamKey, type Department } from "@/lib/filters";
import { useUrlParams } from "./useUrlParams";

/** Segmented control over the fixed department list. The default ("Company") is left out of the URL. */
export function DepartmentFilter({ prefix, value }: { prefix: string; value: Department }) {
  const { setParams, isPending } = useUrlParams();

  return (
    <div
      role="radiogroup"
      aria-label="Department"
      aria-busy={isPending}
      className={`inline-flex rounded-lg border border-border-subtle bg-surface-muted/60 p-0.5 ${isPending ? "opacity-70" : ""}`}
    >
      {DEPARTMENTS.map((dept) => {
        const active = dept === value;
        return (
          <button
            key={dept}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() =>
              !active && setParams({ [departmentParamKey(prefix)]: dept === DEFAULT_DEPARTMENT ? undefined : dept })
            }
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              active ? "bg-surface text-foreground shadow-sm" : "text-foreground/55 hover:text-foreground"
            }`}
          >
            {dept}
          </button>
        );
      })}
    </div>
  );
}
