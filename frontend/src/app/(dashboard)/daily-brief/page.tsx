import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Icon } from "@/components/ui/Icon";
import { companyMeta, dailyBrief } from "@/lib/mock-data";

export default function DailyBriefPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Daily Executive Brief"
        description={`${companyMeta.reportDate} · ${companyMeta.timezone} · Auto-generated summary for ${companyMeta.shortName}`}
      />

      <Card className="mb-6 bg-ink text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Today in one paragraph</p>
        <p className="mt-3 text-[15px] leading-relaxed text-white/85">{dailyBrief.summary}</p>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {dailyBrief.metrics.map((metric) => (
          <StatCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Highlights" subtitle="What went well today" />
          <ul className="space-y-3">
            {dailyBrief.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-sm text-foreground/75">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Icon name="check-circle" className="h-3.5 w-3.5" />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Watch-outs" subtitle="What needs attention" />
          <ul className="space-y-3">
            {dailyBrief.watchOuts.map((w) => (
              <li key={w} className="flex items-start gap-2.5 text-sm text-foreground/75">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                  <Icon name="alert-circle" className="h-3.5 w-3.5" />
                </span>
                {w}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/red-flags">
          <Card className="flex items-center justify-between transition hover:border-teal-dark/40">
            <div>
              <p className="text-sm font-semibold text-foreground">Red Flags</p>
              <p className="text-xs text-foreground/55">5 open items</p>
            </div>
            <Icon name="chevron-right" className="h-4 w-4 text-foreground/30" />
          </Card>
        </Link>
        <Link href="/escalations">
          <Card className="flex items-center justify-between transition hover:border-teal-dark/40">
            <div>
              <p className="text-sm font-semibold text-foreground">Escalations</p>
              <p className="text-xs text-foreground/55">3 open items</p>
            </div>
            <Icon name="chevron-right" className="h-4 w-4 text-foreground/30" />
          </Card>
        </Link>
        <Link href="/watchlist">
          <Card className="flex items-center justify-between transition hover:border-teal-dark/40">
            <div>
              <p className="text-sm font-semibold text-foreground">Watch List</p>
              <p className="text-xs text-foreground/55">4 items tracked</p>
            </div>
            <Icon name="chevron-right" className="h-4 w-4 text-foreground/30" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
