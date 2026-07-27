import type { Metadata } from "next";
import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { ANSWERS } from "@/lib/marketing/answers";
import { SITE_NAME } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Answers — ${SITE_NAME}`,
  description:
    "Answer-first pages for CSRD scope, double materiality, Scope 2 calculation, and filing questions — written for AEO citation.",
  alternates: { canonical: "/answers" },
};

export default function AnswersIndexPage() {
  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: ANSWERS.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `/answers/${a.slug}`,
          name: a.question,
        })),
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label mb-3">AEO</p>
        <h1 className="acid-display-sm text-ink">Answers</h1>
        <p className="mt-5 text-ink-muted">
          One question per page. The first paragraph stands alone so answer engines can
          lift it.
        </p>
        <ul className="mt-10 space-y-4">
          {ANSWERS.map((a) => (
            <li
              key={a.slug}
              className="rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-5"
            >
              <Link
                href={`/answers/${a.slug}`}
                className="text-lg font-medium text-ink hover:text-accent"
              >
                {a.question}
              </Link>
              <p className="mt-2 text-sm text-ink-muted">{a.answer}</p>
            </li>
          ))}
        </ul>
      </main>
    </MarketingLayout>
  );
}
