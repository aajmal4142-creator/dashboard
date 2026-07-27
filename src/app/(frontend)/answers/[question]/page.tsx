import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { ANSWERS, answerBySlug } from "@/lib/marketing/answers";
import { absoluteUrl, SITE_NAME } from "@/lib/marketing/site";

type Props = { params: Promise<{ question: string }> };

export function generateStaticParams() {
  return ANSWERS.map((a) => ({ question: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { question } = await params;
  const a = answerBySlug(question);
  if (!a) return { title: SITE_NAME };
  return {
    title: `${a.question} — ${SITE_NAME}`,
    description: a.answer,
    alternates: { canonical: `/answers/${a.slug}` },
  };
}

export default async function AnswerPage({ params }: Props) {
  const { question } = await params;
  const a = answerBySlug(question);
  if (!a) notFound();

  return (
    <MarketingLayout
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: a.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: a.answer,
            },
          },
        ],
        dateModified: a.updatedAt,
        url: absoluteUrl(`/answers/${a.slug}`),
      }}
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="acid-label">Answers</p>
        <h1 className="mt-2 acid-display-sm leading-tight text-ink">{a.question}</h1>
        <p className="mt-6 text-ink">{a.answer}</p>
        <p className="mt-2 font-data text-xs text-ink-muted">Updated {a.updatedAt}</p>
        {a.sections.map((s) => (
          <section key={s.h2} className="mt-10">
            <h2 className="text-lg font-medium text-ink">{s.h2}</h2>
            <p className="mt-3 text-ink-muted">{s.body}</p>
          </section>
        ))}
        <h2 className="mt-12 text-sm font-medium text-ink">Related</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          {a.related.map((r) => (
            <li key={r}>
              <Link href={`/answers/${r}`} className="acid-link">
                {r}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/glossary/csrd" className="acid-link">
              CSRD glossary
            </Link>
          </li>
          <li>
            <Link href="/dashboard" className="sand-link">
              Open ClearESG
            </Link>
          </li>
        </ul>
      </main>
    </MarketingLayout>
  );
}
