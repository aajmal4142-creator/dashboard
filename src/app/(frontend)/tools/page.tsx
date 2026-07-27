import type { Metadata } from "next";
import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { SITE_NAME } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Free ESG tools — ${SITE_NAME}`,
  description:
    "Ungated CSRD scope checker and Scope 2 calculator. No email wall — the answer is the marketing.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  {
    slug: "csrd-scope",
    name: "CSRD scope checker",
    blurb: "Three inputs → likely in scope or not (educational heuristic).",
  },
  {
    slug: "scope-2",
    name: "Scope 2 calculator",
    blurb: "kWh → tCO2e with a cited illustrative grid factor.",
  },
  {
    slug: "price-estimate",
    name: "Price / readiness estimate",
    blurb: "Sites + Scope 3 + framework → Free/Pro/Consultant vs Envizi footnote.",
  },
  {
    slug: "brsr-readiness",
    name: "BRSR readiness score",
    blurb: "Value-chain / BRSR-readiness quiz — not a filing claim.",
  },
];

export default function ToolsIndexPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label mb-3">Ungated</p>
        <h1 className="acid-display-sm text-ink">Tools</h1>
        <p className="mt-5 text-ink-muted">
          Free, ungated, linkable. Each ends with a path to track the number over time in
          ClearESG.
        </p>
        <ul className="mt-10 space-y-4">
          {TOOLS.map((t) => (
            <li
              key={t.slug}
              className="rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-5 shadow-[var(--shadow-float)]"
            >
              <Link
                href={`/tools/${t.slug}`}
                className="text-lg font-medium text-ink hover:text-accent"
              >
                {t.name}
              </Link>
              <p className="mt-2 text-sm text-ink-muted">{t.blurb}</p>
            </li>
          ))}
        </ul>
      </main>
    </MarketingLayout>
  );
}
