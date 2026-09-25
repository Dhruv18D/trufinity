import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/auth/account-nav";
import { FormAlert } from "@/components/auth/form-controls";
import { buttonClassName } from "@/components/integrations/button-styles";
import { FormButton } from "@/components/integrations/form-button";
import { DetailList, IntegrationCard, ProviderMark, StatusBadge } from "@/components/integrations/integration-card";
import { getSessionToken } from "@/lib/auth/session";
import { getIntegrationsStatus, type QuickBooksStatus, type ServiceTitanStatus } from "@/lib/integrations";
import { connectQuickBooksAction, refreshStatusAction } from "./actions";

export const metadata: Metadata = {
  title: "Integrations · Trufinity",
  robots: { index: false, follow: false },
};

const LOGIN_PATH = "/login?next=/integrations";

const quickBooksNotices: Record<string, { tone: "success" | "error"; message: string }> = {
  connected: { tone: "success", message: "QuickBooks connected successfully." },
  denied: { tone: "error", message: "QuickBooks connection was cancelled. No changes were made." },
  failed: { tone: "error", message: "We couldn't complete the QuickBooks connection. Please try again." },
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

export default async function IntegrationsPage({ searchParams }: PageProps<"/integrations">) {
  const token = await getSessionToken();
  if (!token) redirect(LOGIN_PATH);

  const [params, result] = await Promise.all([searchParams, getIntegrationsStatus(token)]);
  if (result.kind === "unauthenticated") redirect(LOGIN_PATH);

  const notice = typeof params.quickbooks === "string" ? quickBooksNotices[params.quickbooks] : undefined;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="w-full border-b border-black/[.06] dark:border-white/[.08]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Trufinity
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-zinc-500 md:inline dark:text-zinc-400">
              Business Intelligence Dashboard
            </span>
            <AccountNav />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">Integrations</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Connect the business systems Trufinity reads from. Data syncs automatically once a system is connected.
            </p>
          </div>
          <form action={refreshStatusAction}>
            <FormButton variant="secondary" pendingLabel="Checking…">
              Check status
            </FormButton>
          </form>
        </div>

        {notice && <FormAlert tone={notice.tone}>{notice.message}</FormAlert>}

        {result.kind === "unavailable" ? (
          <FormAlert tone="error">
            We couldn&apos;t load integration status right now. Please try again in a moment.
          </FormAlert>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <QuickBooksCard status={result.status.quickbooks} />
            <ServiceTitanCard status={result.status.servicetitan} />
          </div>
        )}
      </main>
    </div>
  );
}

function QuickBooksCard({ status }: { status: QuickBooksStatus }) {
  const expired = !status.connected && status.realmId !== null;
  const badge = status.connected ? (
    <StatusBadge tone="connected" label="Connected" />
  ) : expired ? (
    <StatusBadge tone="warning" label="Reconnect required" />
  ) : (
    <StatusBadge tone="disconnected" label="Not connected" />
  );

  return (
    <IntegrationCard
      name="QuickBooks Online"
      description="Accounting: customers, invoices, payments and accounts."
      logo={<ProviderMark initials="QB" className="bg-[#2CA01C]" />}
      badge={badge}
    >
      {status.realmId ? (
        <DetailList
          items={[
            ...(status.companyName ? [{ label: "Company", value: status.companyName }] : []),
            { label: "Company ID (realm)", value: status.realmId },
            ...(status.refreshTokenExpiresAt
              ? [{ label: status.connected ? "Authorization valid until" : "Authorization expired", value: formatDate(status.refreshTokenExpiresAt) }]
              : []),
          ]}
        />
      ) : (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          You&apos;ll be taken to Intuit to sign in and choose the QuickBooks company to connect, then brought back here.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <form action={connectQuickBooksAction}>
          <FormButton pendingLabel="Redirecting to Intuit…" disabled={!status.configured}>
            {status.realmId ? "Reconnect QuickBooks" : "Connect QuickBooks"}
          </FormButton>
        </form>
        {!status.configured && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            QuickBooks app credentials aren&apos;t configured on the server yet (QBO_CLIENT_ID, QBO_CLIENT_SECRET,
            QBO_AUTH_URL, QBO_TOKEN_URL, QBO_REDIRECT_URI).
          </p>
        )}
      </div>
    </IntegrationCard>
  );
}

function ServiceTitanCard({ status }: { status: ServiceTitanStatus }) {
  const badge = status.connected ? (
    <StatusBadge tone="connected" label="Connected" />
  ) : status.configured ? (
    <StatusBadge tone="warning" label="Connection failing" />
  ) : (
    <StatusBadge tone="disconnected" label="Not connected" />
  );

  return (
    <IntegrationCard
      name="ServiceTitan"
      description="Field service: customers, jobs, appointments, invoices and payments."
      logo={<ProviderMark initials="ST" className="bg-[#0F2B5B]" />}
      badge={badge}
    >
      {status.tenantId && <DetailList items={[{ label: "Tenant ID", value: status.tenantId }]} />}

      {!status.connected && (
        <div className="flex flex-col gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <p>ServiceTitan access is granted by a tenant admin inside ServiceTitan:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Open ServiceTitan and go to <span className="font-medium text-black dark:text-zinc-50">Settings → Integrations → API Application Access</span>.
            </li>
            <li>
              Click <span className="font-medium text-black dark:text-zinc-50">Connect New App</span>, select the Trufinity app, and choose <span className="font-medium text-black dark:text-zinc-50">Allow Access</span>.
            </li>
            <li>Securely share the generated Client ID and Client Secret with your Trufinity administrator.</li>
          </ol>
          {status.configured && (
            <p className="text-amber-700 dark:text-amber-400">
              Credentials are configured but ServiceTitan rejected them. Access may have been revoked; reconnect the app in ServiceTitan.
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <a href={status.connectUrl} target="_blank" rel="noopener noreferrer" className={buttonClassName(status.connected ? "secondary" : "primary")}>
          {status.connected ? "Open ServiceTitan" : "Connect in ServiceTitan"}
          <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </IntegrationCard>
  );
}
