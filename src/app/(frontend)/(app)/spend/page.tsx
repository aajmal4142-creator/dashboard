import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { SpendWizardClient } from "./SpendWizardClient";

export default async function SpendPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canCommit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Emissions</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Spend-based Scope 3</h1>
        <div className="title-rule mt-3" />
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Map GL spend to IO factors (category, region, uncertainty), preview kg CO2e,
          then commit with estimated quality metadata. Factors come from the org registry
          — missing factors throw; nothing is silently zeroed.
        </p>
      </header>

      <div className="mt-10">
        <SpendWizardClient canCommit={canCommit} />
      </div>
    </div>
  );
}
