type StatusTone = "connected" | "disconnected" | "warning";

const toneClasses: Record<StatusTone, string> = {
  connected: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/30",
  disconnected: "bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-400/30",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/30",
};

const dotClasses: Record<StatusTone, string> = {
  connected: "bg-emerald-500",
  disconnected: "bg-zinc-400",
  warning: "bg-amber-500",
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotClasses[tone]}`} />
      {label}
    </span>
  );
}

export function IntegrationCard({
  name,
  logo,
  description,
  badge,
  children,
}: {
  name: string;
  logo: React.ReactNode;
  description: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${name}-heading`}
      className="flex flex-col gap-5 rounded-xl border border-black/[.06] bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {logo}
          <div>
            <h2 id={`${name}-heading`} className="text-base font-semibold text-black dark:text-zinc-50">
              {name}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      {children}
    </section>
  );
}

export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <dt className="text-zinc-500 dark:text-zinc-400">{item.label}</dt>
          <dd className="font-medium break-all text-black dark:text-zinc-50">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProviderMark({ initials, className }: { initials: string; className: string }) {
  return (
    <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white ${className}`}>
      {initials}
    </span>
  );
}
