import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

import { DatabaseWizardClient } from "./DatabaseWizardClient";

export default async function DatabaseConnectionsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const payload = await getPayload({ config });
  const periods = await payload.find({
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
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Integrations</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Database connectors</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Connect PostgreSQL, MySQL, or BigQuery. Credentials are encrypted at rest,
          tested before save, and never returned to the browser. Map columns to ClearESG
          datapoints, then run one-shot or scheduled syncs.
        </p>
      </header>

      <div className="mt-10">
        <DatabaseWizardClient
          canManage={canManage}
          periods={periods.docs.map((p) => ({
            id: p.id,
            label: p.label || p.id,
            status: p.status,
          }))}
        />
      </div>
    </div>
  );
}
