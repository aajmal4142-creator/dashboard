import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { DeviceAssignmentClient } from "./DeviceAssignmentClient";

export default async function IoTDeviceAssignmentPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          Integrations · IoT
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">Device assignment</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Tie each meter to a gateway so ingest tags the correct hub. Bulk-assign via CSV
          with columns <span className="font-mono">device_id,gateway_id</span>.
        </p>
      </header>

      <div className="mt-10">
        <DeviceAssignmentClient canManage={canManage} />
      </div>
    </div>
  );
}
