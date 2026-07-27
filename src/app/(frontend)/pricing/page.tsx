import type { Metadata } from "next";
import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { SITE_NAME, softwareApplicationJsonLd } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Pricing — ${SITE_NAME}`,
  description:
    "ClearESG plans: Free €0 (watermarked PDF), Pro €49/mo, Consultant €199/mo. EUR list prices; India INR/Razorpay is an open decision.",
  alternates: { canonical: "/pricing" },
};

const ROWS: Array<{ plan: keyof typeof PLAN_LIMITS; points: string[] }> = [
  {
    plan: "free",
    points: [
      "Full calculation engine",
      "1 reporting period",
      "3 suppliers",
      "Watermarked PDF",
    ],
  },
  {
    plan: "pro",
    points: ["Unlimited periods", "Clean PDF", "Evidence vault", "10 suppliers"],
  },
  {
    plan: "consultant",
    points: [
      "Everything in Pro",
      "White-label brand",
      "Bulk nudge + templates",
      "10 clients (+€15/client after)",
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingLayout jsonLd={softwareApplicationJsonLd()}>
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label mb-3">Plans</p>
        <h1 className="acid-display-sm text-ink">Pricing</h1>
        <p className="mt-5 max-w-xl text-ink-muted">
          Free is real: full insight, watermarked output. Paid unlocks clean PDF, periods,
          evidence, and consultant tooling. Prices in EUR; India (INR / Razorpay) remains
          an open commercial decision.
        </p>
        <ul className="mt-12 space-y-4">
          {ROWS.map(({ plan, points }) => (
            <li
              key={plan}
              className="rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-6 shadow-[var(--shadow-float)]"
            >
              <p className="acid-label">{PLAN_LIMITS[plan].label}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-data text-ink-muted">€</span>
                <Metric value={PLAN_LIMITS[plan].priceEur} size="xl" decimals={0} />
                <span className="acid-label">/mo</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                {points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 rounded-full" size="sm">
                <Link href="/sign-up">Start</Link>
              </Button>
            </li>
          ))}
        </ul>
      </main>
    </MarketingLayout>
  );
}
