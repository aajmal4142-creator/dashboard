import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { findTeamsIntegrations, mapTeamsIntegrationDoc } from "@/lib/integrations/teams";
import config from "@/payload.config";

import { TeamsClient } from "./TeamsClient";

export default async function TeamsIntegrationPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const payload = await getPayload({ config });

  const listed = await findTeamsIntegrations(payload, {
    where: { organisationId: { equals: ctx.activeOrg.id } },
    limit: 5,
    sort: "-updatedAt",
  });
  const preferred =
    listed.docs.find((d) => d.status === "connected") ?? listed.docs[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Integrations</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Microsoft Teams</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Post alert thresholds into a Teams channel via an Incoming Webhook URL. No
          Microsoft Graph subscription, no Bot Framework hosting. Webhook URLs are
          encrypted at rest.
        </p>
      </header>

      <div className="mt-10">
        <Suspense
          fallback={<p className="text-sm text-ink-muted">Loading Teams settings…</p>}
        >
          <TeamsClient
            canManage={canManage}
            initialIntegration={mapTeamsIntegrationDoc(preferred)}
          />
        </Suspense>
      </div>
    </div>
  );
}
