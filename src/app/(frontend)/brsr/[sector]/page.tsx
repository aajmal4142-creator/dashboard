import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { BRSR_SECTORS, brsrSectorBySlug } from "@/lib/marketing/programmatic";
import { absoluteUrl, SITE_NAME } from "@/lib/marketing/site";

type Props = { params: Promise<{ sector: string }> };

export function generateStaticParams() {
  return BRSR_SECTORS.map((s) => ({ sector: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sector } = await params;
  const s = brsrSectorBySlug(sector);
  if (!s) return { title: SITE_NAME };
  return {
    title: `BRSR readiness for ${s.name} — ${SITE_NAME}`,
    description: s.answer,
    alternates: { canonical: `/brsr/${s.slug}` },
  };
}

export default async function BrsrSectorPage({ params }: Props) {
  const { sector } = await params;
  const s = brsrSectorBySlug(sector);
  if (!s) notFound();

  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `BRSR readiness for ${s.name}`,
        description: s.answer,
        dateModified: s.updatedAt,
        author: { "@type": "Organization", name: SITE_NAME },
        url: absoluteUrl(`/brsr/${s.slug}`),
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label">BRSR readiness · value-chain</p>
        <h1 className="mt-2 acid-display-sm text-ink">BRSR readiness for {s.name}</h1>
        <p className="mt-6 text-ink">{s.answer}</p>
        <p className="mt-4 text-sm text-ink-muted">
          ClearESG does not claim filing-ready XBRL tagging today. Structured export is
          shaped for you or your filing agent to tag later.
        </p>
        <h2 className="mt-10 text-lg font-medium text-ink">Focus topics</h2>
        <ul className="mt-3 space-y-2 font-data text-sm text-ink-muted">
          {s.focusTopics.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/tools/brsr-readiness" className="acid-link">
            BRSR readiness score
          </Link>
          <Link href="/tools/price-estimate" className="acid-link">
            Price estimate
          </Link>
          <Link href="/sign-up" className="acid-link">
            Start free
          </Link>
        </p>
      </main>
    </MarketingLayout>
  );
}
