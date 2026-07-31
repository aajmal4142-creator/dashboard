import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  findSlackIntegrations,
  isSlackAppConfigured,
  mapSlackIntegrationDoc,
} from "@/lib/integrations/slack";
import config from "@/payload.config";

import { SlackClient } from "./SlackClient";

export default async function SlackIntegrationPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const configured = isSlackAppConfigured();
  const payload = await getPayload({ config });

  const listed = await findSlackIntegrations(payload, {
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
        <h1 className="mt-1 font-display text-3xl text-ink">Slack</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Install the ClearESG bot to post alert thresholds into a workspace channel. Bot
          tokens are encrypted at rest. Slash commands and interactive buttons are stubbed
          until a later pass.
        </p>
      </header>

      <div className="mt-10">
        <Suspense
          fallback={<p className="text-sm text-ink-muted">Loading Slack settings…</p>}
        >
          <SlackClient
            canManage={canManage}
            configured={configured}
            initialIntegration={mapSlackIntegrationDoc(preferred)}
          />
        </Suspense>
      </div>
    </div>
  );
}
