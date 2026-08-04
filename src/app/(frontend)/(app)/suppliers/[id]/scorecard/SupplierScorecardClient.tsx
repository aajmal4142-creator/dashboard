"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Metric } from "@/components/ui/metric";
import type { SupplierScorecard } from "@/lib/suppliers/scorecard";

export function SupplierScorecardClient({
  supplier,
}: {
  supplier: { id: string; name: string };
}) {
  const [card, setCard] = useState<SupplierScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/suppliers/${supplier.id}/scorecard`);
      const body = (await res.json()) as {
        error?: string;
        scorecard?: SupplierScorecard;
      };
      if (!res.ok || !body.scorecard) {
        setError(body.error ?? "Could not load scorecard.");
        setCard(null);
        return;
      }
      setCard(body.scorecard);
    } catch {
      setError("Network error loading scorecard. Retry.");
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [supplier.id]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function download(format: "txt" | "csv") {
    setExportMsg(null);
    const a = document.createElement("a");
    a.href = `/api/app/suppliers/${supplier.id}/scorecard?format=${format}`;
    a.download = `supplier-scorecard-${supplier.id}.${format}`;
    a.click();
    setExportMsg(format === "csv" ? "CSV download started." : "Text download started.");
  }

  return (
    <PageFrame
      eyebrow="Supply chain"
      title={`${supplier.name} — ESG scorecard`}
      help="Internal ClearESG quality score (higher is better), inverted from the risk formula. Not an EcoVadis rating."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download("txt")}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Download text
          </button>
          <button
            type="button"
            onClick={() => download("csv")}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Download CSV
          </button>
          <Link
            href={`/suppliers/${supplier.id}/documents`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Documents
          </Link>
          <Link
            href={`/suppliers/${supplier.id}/risk-breakdown`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Risk breakdown
          </Link>
        </div>
      }
    >
      {loading ? <PageSkeleton rows={5} /> : null}

      {!loading && error ? (
        <StatusLine tone="error">
          {error}{" "}
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </StatusLine>
      ) : null}

      {exportMsg ? <StatusLine tone="ok">{exportMsg}</StatusLine> : null}

      {!loading && !error && card ? (
        <div className="space-y-6">
          <PageCard>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Quality score
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-ink">
                  <Metric
                    value={card.qualityScore}
                    unit="/100"
                    size="lg"
                    animate={false}
                  />
                </p>
              </div>
              <div className="text-right text-[12px] text-ink-muted">
                <p>
                  Risk{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {card.riskScore}
                  </span>
                  {" · "}
                  tier{" "}
                  <span className="font-mono uppercase text-ink">{card.riskTier}</span>
                </p>
                <p className="mt-1">
                  Questionnaire{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {card.questionnaireCompletionPercent}%
                  </span>
                  {" · "}
                  docs{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {card.documentCount}
                  </span>
                </p>
              </div>
            </div>
          </PageCard>

          <PageCard title="Pillars (risk, higher = worse)">
            <ul className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["Environmental", card.pillars.environmental],
                  ["Social", card.pillars.social],
                  ["Governance", card.pillars.governance],
                ] as const
              ).map(([label, score]) => (
                <li key={label} className="border-b border-rule pb-2 sm:border-0 sm:pb-0">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                    {score}
                  </p>
                </li>
              ))}
            </ul>
          </PageCard>

          <PageCard title="Summary">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-muted">
              {card.summaryLines.join("\n")}
            </pre>
          </PageCard>
        </div>
      ) : null}
    </PageFrame>
  );
}
