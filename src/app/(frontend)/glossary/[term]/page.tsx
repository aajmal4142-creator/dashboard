import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { GLOSSARY, glossaryBySlug } from "@/lib/marketing/glossary";
import { absoluteUrl, SITE_NAME } from "@/lib/marketing/site";

type Props = { params: Promise<{ term: string }> };

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term: slug } = await params;
  const t = glossaryBySlug(slug);
  if (!t) return { title: SITE_NAME };
  return {
    title: `${t.term} — ${SITE_NAME} glossary`,
    description: t.answer,
    alternates: { canonical: `/glossary/${t.slug}` },
  };
}

export default async function GlossaryTermPage({ params }: Props) {
  const { term: slug } = await params;
  const t = glossaryBySlug(slug);
  if (!t) notFound();

  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name: t.term,
        description: t.answer,
        url: absoluteUrl(`/glossary/${t.slug}`),
        dateModified: t.updatedAt,
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label">Glossary</p>
        <h1 className="mt-2 acid-display-sm text-ink">{t.term}</h1>
        <p className="mt-6 text-ink">{t.answer}</p>
        <p className="mt-2 font-data text-xs text-ink-muted">Updated {t.updatedAt}</p>
        {t.body.map((para) => (
          <p key={para.slice(0, 24)} className="mt-6 text-ink-muted">
            {para}
          </p>
        ))}
        <h2 className="mt-10 text-sm font-medium text-ink">Related</h2>
        <ul className="mt-3 flex flex-wrap gap-3 text-sm text-ink-muted">
          {t.related.map((r) => (
            <li key={r}>
              <Link href={`/glossary/${r}`} className="acid-link">
                {r}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/tools/csrd-scope" className="acid-link">
              CSRD scope checker
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="acid-link">
              Pricing
            </Link>
          </li>
        </ul>
      </main>
    </MarketingLayout>
  );
}
