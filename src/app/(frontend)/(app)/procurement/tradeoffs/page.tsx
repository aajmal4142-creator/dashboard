import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { TradeoffsClient } from "./TradeoffsClient";

export const metadata = {
  title: "Procurement trade-offs | ClearESG",
};

export default async function ProcurementTradeoffsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--accent)]">
          Procurement
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          Trade-off modeller
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Compare purchase options on cost versus estimated carbon (and optional lead
          time). Ranking is deterministic — weighted score or Pareto. Missing cost or
          carbon are marked missing, never zeroed. No AI, no paid supplier risk APIs.
        </p>
      </div>

      <TradeoffsClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
