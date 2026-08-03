import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { ResidualClient } from "./ResidualClient";

export const metadata = {
  title: "Residual emissions & offsets | ClearESG",
};

export default async function ResidualPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          Residual emissions & offsets
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Track residual emissions after reductions and a user-entered carbon credit
          ledger. Net position = inventory − reductions − retired credits. ClearESG is not
          a credit marketplace and does not sync paid registries. Energy certificates (REC
          / GO / EAC) belong under Energy certificates, not here. Missing inventory or
          reductions are never treated as zero.
        </p>
      </div>

      <ResidualClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
