import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { COMPETITORS, competitorBySlug } from "@/lib/marketing/programmatic";
import { absoluteUrl, SITE_NAME } from "@/lib/marketing/site";

type Props = { params: Promise<{ competitor: string }> };

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitor } = await params;
  const c = competitorBySlug(competitor);
  if (!c) return { title: SITE_NAME };
  return {
    title: `ClearESG vs ${c.name} — ${SITE_NAME}`,
    description: c.answer,
    alternates: { canonical: `/compare/${c.slug}` },
  };
}

export default async function ComparePage({ params }: Props) {
  const { competitor } = await params;
  const c = competitorBySlug(competitor);
  if (!c) notFound();

  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `ClearESG vs ${c.name}`,
        description: c.answer,
        dateModified: c.updatedAt,
        url: absoluteUrl(`/compare/${c.slug}`),
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label">Compare</p>
        <h1 className="mt-2 acid-display-sm text-ink">ClearESG vs {c.name}</h1>
        <p className="mt-6 text-ink">{c.answer}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-5">
            <h2 className="text-sm font-medium text-ink">Where {c.name} wins</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {c.whereTheyWin.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-5">
            <h2 className="text-sm font-medium text-ink">Where ClearESG wins</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {c.whereWeWin.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/pricing" className="acid-link">
            Pricing
          </Link>
          <Link href="/compare/persefoni" className="acid-link">
            vs Persefoni
          </Link>
          <Link href="/compare/greenly" className="acid-link">
            vs Greenly
          </Link>
        </p>
      </main>
    </MarketingLayout>
  );
}
