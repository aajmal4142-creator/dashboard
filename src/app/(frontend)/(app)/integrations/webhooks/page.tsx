import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";
import { hasMinRole } from "@/lib/access/membership";

import { WebhooksClient } from "./WebhooksClient";

export default async function WebhooksIntegrationPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = Boolean(ctx.role && hasMinRole(ctx.role, "admin"));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Integrations</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Webhooks</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Register outbound endpoints, inspect delivery attempts, and replay dead-letter
          failures. Retries use exponential backoff from each registration&apos;s retry
          policy.
        </p>
      </header>

      <div className="mt-10">
        <WebhooksClient canManage={canManage} />
      </div>
    </div>
  );
}
