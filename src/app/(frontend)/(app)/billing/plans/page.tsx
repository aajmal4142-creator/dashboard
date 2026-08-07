import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";
import {
  ANNUAL_DISCOUNT_LABEL,
  formatUsdAnnual,
  formatUsdMonthly,
  PLAN_LIMITS,
  type PlanId,
} from "@/lib/billing/plans";

const CATALOG: PlanId[] = ["free", "pro", "professional", "consultant", "enterprise"];

export default async function PlansPage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  return (
    <div className="min-h-screen bg-canvas p-8 text-ink">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/billing"
          className="mb-4 inline-block text-[13px] text-accent underline-offset-2 hover:underline"
        >
          ← Back to billing
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Choose your plan
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
          14-day free trial of Pro — no credit card required. Annual billing:{" "}
          {ANNUAL_DISCOUNT_LABEL} (≈ 2 months free).
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CATALOG.map((id) => {
            const plan = PLAN_LIMITS[id];
            const annual = formatUsdAnnual(id);
            return (
              <div key={id} className="rounded-[6px] border border-rule bg-surface-1 p-6">
                <h3 className="font-display text-xl font-semibold">{plan.label}</h3>
                <p className="mt-2 font-data text-3xl font-bold tabular-nums">
                  {formatUsdMonthly(id)}
                </p>
                {annual ? (
                  <p className="mt-1 font-data text-[12px] text-ink-muted">
                    or {annual} · {ANNUAL_DISCOUNT_LABEL}
                  </p>
                ) : id === "enterprise" ? (
                  <p className="mt-1 text-[12px] text-ink-muted">Contact sales</p>
                ) : (
                  <p className="mt-1 text-[12px] text-ink-muted">Forever free</p>
                )}
                <p className="mt-4 text-[13px] text-ink-muted">{plan.blurb}</p>
                <Link
                  href="/billing"
                  className="mt-6 inline-flex rounded-[4px] border border-rule-strong bg-surface-2 px-3 py-2 text-[13px] font-medium text-ink hover:border-accent"
                >
                  {id === "enterprise" ? "Contact sales" : "Manage on Billing"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
