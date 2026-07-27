import type { Metadata } from "next";
import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { GLOSSARY } from "@/lib/marketing/glossary";
import { SITE_NAME } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `ESG glossary — ${SITE_NAME}`,
  description:
    "Definitions for Scope 3, double materiality, ESRS E1, CSRD, emission factors, VSME, and BRSR — written for citation.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryIndexPage() {
  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: "ClearESG ESG glossary",
        hasDefinedTerm: GLOSSARY.map((t) => ({
          "@type": "DefinedTerm",
          name: t.term,
          description: t.answer,
          url: `/glossary/${t.slug}`,
        })),
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label mb-3">Definitions</p>
        <h1 className="acid-display-sm text-ink">Glossary</h1>
        <p className="mt-5 text-ink-muted">
          Short, dated definitions written so answer engines can cite them. Each term
          links to related entries and product tools.
        </p>
        <ul className="mt-10 space-y-4">
          {GLOSSARY.map((t) => (
            <li
              key={t.slug}
              className="rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-5"
            >
              <Link
                href={`/glossary/${t.slug}`}
                className="text-lg font-medium text-ink hover:text-accent"
              >
                {t.term}
              </Link>
              <p className="mt-2 text-sm text-ink-muted">{t.answer}</p>
            </li>
          ))}
        </ul>
      </main>
    </MarketingLayout>
  );
}
