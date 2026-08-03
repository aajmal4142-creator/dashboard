import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { MaccClient } from "./MaccClient";

export const metadata = {
  title: "MACC / abatement ROI | ClearESG",
};

export default async function MaccPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--accent)]">
          Analytics
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          MACC / abatement ROI
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Marginal abatement cost curve from user-entered levers. Cost per tCO₂e uses
          straight-line CAPEX amortisation plus OPEX — no discount rate, no paid factor
          APIs. Incomplete costs or abatement are marked missing, never zeroed.
        </p>
      </div>

      <MaccClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
