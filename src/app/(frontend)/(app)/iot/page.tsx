import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { IoTDashboardClient } from "./IoTDashboardClient";

export default async function IoTPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Integrations</p>
        <h1 className="mt-1 font-display text-3xl text-ink">IoT meters</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Register devices, ingest REST readings with API keys, and review online status,
          anomalies, and 24-hour aggregates. Readings map to datapoints via the emissions
          factor registry. Multi-gateway hubs live under{" "}
          <Link
            href="/integrations/iot/gateways"
            className="text-accent hover:text-accent-hover"
          >
            Integrations → IoT gateways
          </Link>
          .
        </p>
      </header>

      <div className="mt-10">
        <IoTDashboardClient canManage={canManage} />
      </div>
    </div>
  );
}
