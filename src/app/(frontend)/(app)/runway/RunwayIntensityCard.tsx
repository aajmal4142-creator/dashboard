"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { EmissionsIntensityResult } from "@/lib/analytics/consumptionIntensity";

type IntensityCardResponse = {
  period: number;
  current: EmissionsIntensityResult;
  changePercent: number | null;
  benchmarkMedian: number | null;
  status: string;
};

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function changeTone(change: number | null): string {
  if (change === null) return "text-ink-muted";
  if (change < 0) return "text-signal";
  if (change > 0) return "text-rust";
  return "text-ink-muted";
}

/**
 * Dashboard intensity card — current per-revenue intensity + YoY change.
 */
export function RunwayIntensityCard() {
  const [data, setData] = useState<IntensityCardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(
          `/api/app/analytics/intensity?period=${year}&type=per_revenue`,
        );
        if (!res.ok) {
          const body: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Unavailable");
        }
        const json = (await res.json()) as IntensityCardResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[16px] text-ink">Intensity</h2>
        <Link
          href="/analytics/intensity"
          className="text-[12px] text-accent hover:text-accent-hover"
        >
          Detail
        </Link>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-[4px] bg-surface-2" aria-hidden />
      ) : error || !data ? (
        <p className="text-[13px] text-ink-muted">
          {error === "No reporting periods found"
            ? "Open a reporting period to compute intensity."
            : "Intensity unavailable until revenue and emissions are present."}
        </p>
      ) : (
        <>
          <p className="font-data text-[28px] tabular-nums leading-none text-ink">
            {fmtNum(data.current.value)}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">{data.current.unit}</p>
          <p
            className={`mt-3 text-[13px] font-data tabular-nums ${changeTone(data.changePercent)}`}
          >
            {data.changePercent === null
              ? "YoY change —"
              : `${data.changePercent > 0 ? "+" : ""}${fmtNum(data.changePercent, 1)}% YoY`}
          </p>
          {data.benchmarkMedian != null ? (
            <p className="mt-2 text-[11px] text-ink-muted">
              Peer median{" "}
              <span className="font-data tabular-nums">
                {fmtNum(data.benchmarkMedian)}
              </span>
            </p>
          ) : data.current.explanation ? (
            <p className="mt-2 text-[11px] text-ink-muted">{data.current.explanation}</p>
          ) : (
            <p className="mt-2 text-[11px] text-ink-muted">
              Peer median unavailable for this cohort.
            </p>
          )}
        </>
      )}
    </div>
  );
}
