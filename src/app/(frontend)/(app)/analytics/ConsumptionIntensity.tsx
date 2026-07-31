"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type {
  EmissionsIntensityResult,
  IntensityPeerStatus,
  IntensityType,
} from "@/lib/analytics/consumptionIntensity";

type IntensityTypeRow = {
  type: IntensityType;
  current: EmissionsIntensityResult;
  previous_year: EmissionsIntensityResult | null;
  changePercent: number | null;
  benchmarkMedian: number | null;
  status: IntensityPeerStatus;
};

type IntensityAllResponse = {
  period: number;
  totalEmissions: number;
  types: Record<IntensityType, IntensityTypeRow>;
  denominators: {
    annualRevenue: number | null;
    employeeCount: number | null;
    annualOutputUnits: number | null;
    outputUnitLabel: string | null;
    floorAreaSqm: number | null;
  };
  emissionsMessage?: string | null;
};

const TYPE_LABELS: Record<IntensityType, string> = {
  per_revenue: "Per revenue",
  per_employee: "Per employee",
  per_output: "Per output",
  per_square_meter: "Per square meter",
};

const TYPE_ORDER: IntensityType[] = [
  "per_revenue",
  "per_employee",
  "per_output",
  "per_square_meter",
];

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function statusLabel(status: IntensityPeerStatus): string {
  switch (status) {
    case "better_than_median":
      return "Better than peer median";
    case "worse_than_median":
      return "Above peer median";
    case "at_median":
      return "Near peer median";
    case "unavailable":
      return "Peer median unavailable";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

function changeTone(change: number | null): string {
  if (change === null) return "text-ink-muted";
  if (change < 0) return "text-signal";
  if (change > 0) return "text-rust";
  return "text-ink-muted";
}

export default function ConsumptionIntensity() {
  const [data, setData] = useState<IntensityAllResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`/api/app/analytics/intensity?period=${year}`);
        if (!res.ok) {
          const body: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch intensity metrics");
        }
        const json = (await res.json()) as IntensityAllResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load intensity metrics",
          );
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

  if (loading) {
    return (
      <div
        className="h-64 w-full animate-pulse rounded-[6px] border border-rule bg-surface-2"
        aria-hidden
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <p className="font-display text-[16px] text-ink">Emissions intensity</p>
        <p className="mt-2 text-[13px] text-ink-muted">
          {error}. Confirm organisation denominators and reporting periods, then retry.
        </p>
      </div>
    );
  }

  if (!data?.types) {
    return (
      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <p className="font-display text-[16px] text-ink">Emissions intensity</p>
        <p className="mt-2 text-[13px] text-ink-muted">
          No intensity data available yet. Add annual revenue, headcount, or output on the
          organisation, then enter activity data for the period.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-[18px] text-ink">Emissions intensity</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Period {data.period}
              {" · "}
              <span className="font-data tabular-nums">
                {fmtNum(data.totalEmissions, 1)}
              </span>
              {" tCO2e total"}
            </p>
          </div>
          <Link
            href="/analytics/intensity"
            className="text-[12px] text-accent hover:text-accent-hover"
          >
            Full detail
          </Link>
        </div>

        {data.emissionsMessage ? (
          <p className="mb-4 text-[12px] text-ink-muted">{data.emissionsMessage}</p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TYPE_ORDER.map((type) => {
            const row = data.types[type];
            if (!row) return null;
            return (
              <div
                key={type}
                className="rounded-[6px] border border-rule bg-surface-2 p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {TYPE_LABELS[type]}
                </p>
                <p className="mt-2 font-data text-[22px] tabular-nums text-ink">
                  {fmtNum(row.current.value)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{row.current.unit}</p>
                <p
                  className={`mt-2 text-[12px] font-data tabular-nums ${changeTone(row.changePercent)}`}
                >
                  {row.changePercent === null
                    ? "YoY —"
                    : `${row.changePercent > 0 ? "+" : ""}${fmtNum(row.changePercent, 1)}% YoY`}
                </p>
                {row.current.explanation ? (
                  <p className="mt-2 text-[11px] text-ink-muted">
                    {row.current.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <h3 className="font-display text-[16px] text-ink">Peer median comparison</h3>
        <p className="mt-1 text-[12px] text-ink-muted">
          Lower intensity is better. Cohort medians publish only when n ≥ 8 and consent
          gates allow.
        </p>
        <div className="mt-4 divide-y divide-rule">
          {TYPE_ORDER.map((type) => {
            const row = data.types[type];
            if (!row) return null;
            return (
              <div
                key={type}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-[13px] text-ink">{TYPE_LABELS[type]}</p>
                  <p className="text-[11px] text-ink-muted">{statusLabel(row.status)}</p>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                      You
                    </p>
                    <p className="font-data text-[14px] tabular-nums text-ink">
                      {fmtNum(row.current.value)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                      Median
                    </p>
                    <p className="font-data text-[14px] tabular-nums text-ink">
                      {fmtNum(row.benchmarkMedian)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <h3 className="font-display text-[16px] text-ink">Denominators</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
          <div>
            <dt className="text-ink-muted">Annual revenue</dt>
            <dd className="font-data tabular-nums text-ink">
              {fmtNum(data.denominators.annualRevenue, 0)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Employees</dt>
            <dd className="font-data tabular-nums text-ink">
              {fmtNum(data.denominators.employeeCount, 0)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">
              Output
              {data.denominators.outputUnitLabel
                ? ` (${data.denominators.outputUnitLabel})`
                : ""}
            </dt>
            <dd className="font-data tabular-nums text-ink">
              {fmtNum(data.denominators.annualOutputUnits, 0)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Floor area m²</dt>
            <dd className="font-data tabular-nums text-ink">
              {fmtNum(data.denominators.floorAreaSqm, 0)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
