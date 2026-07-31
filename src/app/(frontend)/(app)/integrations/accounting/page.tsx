import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { parseCategoryMapping } from "@/lib/integrations/accounting";
import config from "@/payload.config";

import { AccountingClient } from "./AccountingClient";

export default async function AccountingIntegrationPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const payload = await getPayload({ config });

  const [connections, periods] = await Promise.all([
    payload.find({
      collection: "accounting-connections",
      where: { organisationId: { equals: ctx.activeOrg.id } },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: "reporting-periods",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { status: { equals: "open" } },
        ],
      },
      sort: "-startDate",
      limit: 20,
      depth: 0,
      overrideAccess: true,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Integrations</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Accounting connectors</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Connect QuickBooks Online, Xero, or Wave to pull spend by account, map chart of
          accounts to emissions categories, and calculate spend-based emissions. Without
          OAuth client secrets, ClearESG uses an encrypted sandbox sync — no paid API
          required.
        </p>
      </header>

      <div className="mt-10">
        <AccountingClient
          canManage={canManage}
          periods={periods.docs.map((p) => ({
            id: p.id,
            label: p.label || p.id,
            status: p.status,
          }))}
          initialConnections={connections.docs.map((c) => ({
            id: c.id,
            provider: c.provider as "xero" | "quickbooks" | "wave",
            status: (c.status || "pending") as
              "pending" | "connected" | "failed" | "expired",
            connectionMode: (c.connectionMode || "sandbox") as "sandbox" | "live",
            companyName: c.companyName ?? null,
            connectedAt: c.connectedAt ? String(c.connectedAt) : null,
            lastSyncAt: c.lastSyncAt ? String(c.lastSyncAt) : null,
            nextSyncAt: c.nextSyncAt ? String(c.nextSyncAt) : null,
            lastSyncStatus: c.lastSyncStatus ?? null,
            syncErrorCount: c.syncErrorCount ?? 0,
            syncConfig: {
              enableExpenseSync: c.syncConfig?.enableExpenseSync ?? true,
              enableBankFeedSync: c.syncConfig?.enableBankFeedSync ?? false,
              enableAutoCateg: c.syncConfig?.enableAutoCateg ?? true,
              syncFrequency: c.syncConfig?.syncFrequency || "manual",
            },
            expenseCategoryMapping: parseCategoryMapping(c.expenseCategoryMapping),
            discoveredAccounts: Array.isArray(c.discoveredAccounts)
              ? (c.discoveredAccounts as Array<{ code: string; name: string }>)
              : [],
          }))}
        />
      </div>
    </div>
  );
}
