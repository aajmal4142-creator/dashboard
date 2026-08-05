import Link from "next/link";

import { PageCard, PageFrame } from "@/components/shell/PageFrame";

export const metadata = {
  title: "Revenue recognition | ClearESG",
};

/**
 * ASC 606 / IFRS 15 operator checklist — not an ERP subledger.
 */
export default function RevenueRecognitionPage() {
  const items = [
    {
      title: "Identify the contract",
      body: "Confirm written or electronic agreement, commercial substance, and collectability. Multi-year terms live on the subscription (contractTermYears / contractEndsAt).",
    },
    {
      title: "Identify performance obligations",
      body: "ClearESG SaaS access is typically a single stand-ready obligation over the service period. Add-ons (assurance packs, implementation) may be distinct — document separately.",
    },
    {
      title: "Determine transaction price",
      body: "List price × seats, less annual / volume / multi-year discounts. Variable consideration (usage overages) estimate or constrain per policy.",
    },
    {
      title: "Allocate the transaction price",
      body: "If multiple obligations exist, allocate on relative standalone selling price. Single-obligation subscriptions skip allocation.",
    },
    {
      title: "Recognise revenue when (or as) obligations are satisfied",
      body: "Over time for stand-ready SaaS (typically straight-line over the billing period). Defer prepaid annual invoices; release monthly. Do not recognise the full multi-year cash receipt on day one.",
    },
    {
      title: "Trial & extensions",
      body: "Trial periods with no consideration are generally not revenue. Conversions start recognition at paid period start. Track trialExtensionCount for audit trail.",
    },
    {
      title: "Modifications",
      body: "Seat changes, cycle switches, and mid-term upgrades — treat as contract modifications (prospective vs cumulative catch-up) per ASC 606-10-25-10 / IFRS 15.21.",
    },
  ];

  return (
    <PageFrame
      eyebrow="Billing"
      title="Revenue recognition notes"
      help="Operator checklist aligned to ASC 606 and IFRS 15. ClearESG records commercial fields and invoices; your finance system remains the book of record."
      actions={
        <Link
          href="/billing"
          className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
        >
          Back to billing
        </Link>
      }
    >
      <div className="space-y-4">
        <PageCard title="Scope">
          <p className="text-[13px] text-ink-muted">
            This page is guidance for finance operators using ClearESG billing. It does
            not post journal entries, calculate deferred revenue balances, or replace your
            ERP.
          </p>
        </PageCard>
        {items.map((item, i) => (
          <PageCard key={item.title} title={`${i + 1}. ${item.title}`}>
            <p className="text-[13px] text-ink-muted">{item.body}</p>
          </PageCard>
        ))}
      </div>
    </PageFrame>
  );
}
