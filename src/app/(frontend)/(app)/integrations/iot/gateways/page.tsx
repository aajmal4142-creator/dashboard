import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { GatewaysClient } from "./GatewaysClient";

export default async function IoTGatewaysPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          Integrations · IoT
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">Gateways</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Register multiple IoT hubs per organisation. Each gateway syncs independently;
          credentials are encrypted at rest. Offline hubs raise alerts after 30 minutes
          and suggest same-type failover peers.
        </p>
      </header>

      <div className="mt-10">
        <GatewaysClient canManage={canManage} />
      </div>
    </div>
  );
}
