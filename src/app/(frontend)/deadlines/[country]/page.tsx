import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { DEADLINES, deadlineBySlug } from "@/lib/marketing/programmatic";
import { absoluteUrl, SITE_NAME } from "@/lib/marketing/site";

type Props = { params: Promise<{ country: string }> };

export function generateStaticParams() {
  return DEADLINES.map((d) => ({ country: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const d = deadlineBySlug(country);
  if (!d) return { title: SITE_NAME };
  return {
    title: `ESG reporting deadlines — ${d.country} — ${SITE_NAME}`,
    description: d.answer,
    alternates: { canonical: `/deadlines/${d.slug}` },
  };
}

export default async function DeadlinePage({ params }: Props) {
  const { country } = await params;
  const d = deadlineBySlug(country);
  if (!d) notFound();

  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `ESG reporting deadlines — ${d.country}`,
        description: d.answer,
        dateModified: d.updatedAt,
        url: absoluteUrl(`/deadlines/${d.slug}`),
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label">Deadlines · {d.iso}</p>
        <h1 className="mt-2 acid-display-sm text-ink">
          ESG reporting deadlines — {d.country}
        </h1>
        <p className="mt-6 text-ink">{d.answer}</p>
        <ul className="mt-8 space-y-3 text-sm text-ink-muted">
          {d.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/answers/does-csrd-apply-outside-eu" className="sand-link">
            Does CSRD apply outside the EU?
          </Link>
          <Link href="/dashboard" className="sand-link">
            Open runway
          </Link>
        </p>
      </main>
    </MarketingLayout>
  );
}
