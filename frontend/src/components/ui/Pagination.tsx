import Link from "next/link";
import { Icon } from "./Icon";
import { formatCount } from "@/lib/format";

/** Link-based pagination for server-rendered tables; keeps existing query params. */
export function Pagination({
  basePath,
  query,
  page,
  pageSize,
  totalCount,
}: {
  basePath: string;
  query: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const btn = "inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium";

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3 text-xs text-foreground/55 sm:px-6">
      <span>
        Page {formatCount(page)} of {formatCount(lastPage)} · {formatCount(totalCount)} records
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} text-foreground hover:bg-surface-muted`}>
            <Icon name="chevron-left" className="h-3.5 w-3.5" /> Prev
          </Link>
        ) : (
          <span className={`${btn} text-foreground/30`}>
            <Icon name="chevron-left" className="h-3.5 w-3.5" /> Prev
          </span>
        )}
        {page < lastPage ? (
          <Link href={href(page + 1)} className={`${btn} text-foreground hover:bg-surface-muted`}>
            Next <Icon name="chevron-right" className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className={`${btn} text-foreground/30`}>
            Next <Icon name="chevron-right" className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function FilterChips({
  basePath,
  param,
  options,
  active,
}: {
  basePath: string;
  param: string;
  options: { value: string; label: string }[];
  active?: string;
}) {
  const chip = (value: string | undefined, label: string) => {
    const isActive = (active ?? "") === (value ?? "");
    return (
      <Link
        key={value ?? "all"}
        href={value ? `${basePath}?${param}=${encodeURIComponent(value)}` : basePath}
        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
          isActive ? "bg-ink text-white" : "bg-surface-muted text-foreground/60 hover:bg-surface-muted/70"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {chip(undefined, "All")}
      {options.map((o) => chip(o.value, o.label))}
    </div>
  );
}
