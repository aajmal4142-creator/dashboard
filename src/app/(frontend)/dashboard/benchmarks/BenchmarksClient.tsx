"use client";

import { useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { MembershipRole } from "@/lib/access/membership";
import { sectorLabel } from "@/lib/ui/displayLabels";

type BenchmarkPayload =
  | {
      available: false;
      reason?: string;
      message?: string;
      minCohortSize: number;
      benchmarkOptOut?: boolean;
    }
  | {
      available: true;
      sector: string;
      metricKey: string;
      p25: number;
      p50: number;
      p75: number;
      cohortSize: number;
      computedAt?: string | null;
      userValue: number | null;
      percentileRank: number | null;
      improve: Array<{ label: string; href: string }>;
      benchmarkOptOut?: boolean;
    };

function emptyBenchmarkBody(
  data: Extract<BenchmarkPayload, { available: false }>,
): string {
  if (data.reason === "cohorts_not_published") {
    return (
      data.message ??
      "Sector cohorts are not published yet. Mechanism is ready; live publication awaits consent sign-off."
    );
  }
  if (data.reason === "Forbidden") {
    return "This cohort is not available for your organisation yet.";
  }
  return (
    data.message ??
    `Not enough peers yet. We need at least ${data.minCohortSize} organisations before percentiles appear.`
  );
}

export function BenchmarksClient({
  initial,
  role = null,
}: {
  initial: BenchmarkPayload;
  role?: MembershipRole | null;
}) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const canRecompute = role === "owner" || role === "admin";
  const showRecompute = canRecompute || role === null;

  const [optOut, setOptOut] = useState(
    "benchmarkOptOut" in initial ? Boolean(initial.benchmarkOptOut) : false,
  );

  async function toggleOptOut() {
    const next = !optOut;
    setStatusTone("neutral");
    setStatus(next ? "Opting out…" : "Opting in…");
    const res = await fetch("/api/app/benchmarks/opt-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optOut: next }),
    });
    if (!res.ok) {
      setStatusTone("error");
      setStatus("Could not update benchmark preference");
      return;
    }
    setOptOut(next);
    setStatusTone("ok");
    setStatus(
      next ? "Opted out of cohort contribution" : "Opted in to cohort contribution",
    );
  }

  async function recompute() {
    setStatusTone("neutral");
    setStatus("Updating sector comparison…");
    const res = await fetch("/api/app/benchmarks/recompute", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      written?: number;
    };
    if (!res.ok) {
      const raw = body.error ?? "Could not update cohorts";
      setStatusTone("error");
      setStatus(
        raw === "Forbidden"
          ? "Updating cohorts requires an admin or owner. Ask a teammate with that role."
          : raw,
      );
      return;
    }
    const get = await fetch("/api/app/benchmarks?metricKey=electricity_kwh");
    const next = (await get.json()) as BenchmarkPayload;
    setData(next);
    setStatusTone("ok");
    setStatus(
      body.written && body.written > 0
        ? `Updated ${body.written} cohort(s)`
        : "No new cohorts yet — more organisations need published electricity data",
    );
  }

  return (
    <PageFrame
      eyebrow="Benchmarking"
      title="Sector position"
      help="Comparisons stay private until at least eight organisations share a sector cohort."
      actions={
        showRecompute ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void recompute()}
          >
            {!data.available ? "Check for new peers" : "Refresh cohorts"}
          </Button>
        ) : role !== null ? (
          <p className="text-[13px] text-ink-muted">Cohort refresh is admin-only</p>
        ) : null
      }
      rail={
        <div className="space-y-3 text-[13px] text-ink-muted">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
            Privacy
          </p>
          <p>
            Opted-out organisations neither contribute nor appear. Small cohorts never
            surface percentiles. No min/max peer values are shown.
          </p>
          {canRecompute ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void toggleOptOut()}
            >
              {optOut ? "Opt back in" : "Opt out of contribution"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        {!data.available ? (
          <EmptyState title="No cohort available" body={emptyBenchmarkBody(data)} />
        ) : (
          <>
            <PageCard
              title={`${data.metricKey} · ${sectorLabel(data.sector)} · ${data.cohortSize} organisations`}
            >
              {data.computedAt ? (
                <p className="mb-4 text-[11px] text-ink-muted">
                  As of {new Date(data.computedAt).toISOString().slice(0, 10)}
                </p>
              ) : null}
              <div className="flex items-end gap-2">
                {(
                  [
                    ["p25", data.p25],
                    ["p50", data.p50],
                    ["p75", data.p75],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex-1">
                    <div
                      className="w-full rounded-[2px] bg-surface-2"
                      style={{
                        height: `${Math.max(8, (value / (data.p75 * 1.4)) * 120)}px`,
                      }}
                    />
                    <p className="mt-2 font-data text-[13px] text-ink">
                      {value.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              {data.userValue !== null ? (
                <p className="mt-6 font-data text-[13px] text-ink">
                  You: {data.userValue.toLocaleString()}
                  {data.percentileRank !== null
                    ? ` · ~${data.percentileRank}th percentile`
                    : ""}
                </p>
              ) : (
                <p className="mt-6 text-[13px] text-ink-muted">
                  Enter {data.metricKey} to mark your position.
                </p>
              )}
            </PageCard>

            <PageCard title="How to improve">
              <ul>
                {data.improve.map((a) => (
                  <li key={a.href}>
                    <a
                      href={a.href}
                      className="block border-b border-rule py-2.5 text-[13px] text-ink transition-colors last:border-b-0 hover:bg-surface-2 hover:text-accent"
                    >
                      {a.label}
                    </a>
                  </li>
                ))}
              </ul>
            </PageCard>
          </>
        )}
      </div>
    </PageFrame>
  );
}
