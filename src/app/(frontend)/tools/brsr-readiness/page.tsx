"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";

const QUESTIONS = [
  {
    id: "listed_customer",
    q: "Has a listed customer asked you for ESG / BRSR value-chain data?",
  },
  {
    id: "energy",
    q: "Can you produce electricity and fuel figures for the last year?",
  },
  {
    id: "evidence",
    q: "Do you keep invoices or meters that prove those figures?",
  },
  {
    id: "suppliers",
    q: "Do you need data from your own suppliers (Scope 3)?",
  },
  {
    id: "deadline",
    q: "Do you have a deadline under 180 days?",
  },
] as const;

export default function BrsrReadinessToolPage() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const score = useMemo(() => {
    let s = 0;
    for (const q of QUESTIONS) {
      if (answers[q.id] === true) s += 20;
    }
    return s;
  }, [answers]);

  return (
    <MarketingLayout>
      <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
        <p className="acid-label">Tool</p>
        <h1 className="mt-2 acid-display-sm text-ink">BRSR readiness score</h1>
        <p className="mt-4 text-ink-muted">
          For value-chain suppliers and voluntary reporters — not a claim that you can
          file SEBI BRSR XBRL today. Score is indicative.
        </p>
        <ul className="mt-10 space-y-4">
          {QUESTIONS.map((q) => (
            <li key={q.id} className="border-b border-rule py-4">
              <p className="text-sm text-ink">{q.q}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <button
                  type="button"
                  className="text-accent"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: true }))}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="text-ink-muted"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: false }))}
                >
                  No
                </button>
                <span className="font-data text-xs text-ink-muted">
                  {answers[q.id] === undefined ? "—" : answers[q.id] ? "Yes" : "No"}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 border border-rule p-6">
          <p className="label-caps">Score</p>
          <p className="font-data mt-2 text-3xl text-ink">{score}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {score >= 60
              ? "You can start a BRSR-readiness workspace and attach evidence now."
              : "Start with the 60-second baseline and replace estimates one field at a time."}
          </p>
          <Link href="/sign-up" className="acid-link mt-4 inline-block">
            Save this and track it over time
          </Link>
        </div>
      </main>
    </MarketingLayout>
  );
}
