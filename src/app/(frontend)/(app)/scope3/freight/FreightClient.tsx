"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { METRICS_HREF } from "@/lib/metrics";
import { cn } from "@/lib/utils";

type ActivityRow = {
  metricKey: string;
  label: string;
  unit: string;
  group: "upstream" | "downstream";
  datapointId: string | null;
  value: number | null;
  quality: string;
};

type PeriodRow = {
  id: string;
  label: string;
  status: string;
  startDate: string;
  endDate: string;
};

type Computation = {
  totalTco2e: number;
  quality: string;
  components: Array<{
    key: string;
    label: string;
    valueTco2e: number;
    factorKey: string;
    factorValue: number;
    factorUnit: string;
  }>;
  missingInputs: string[];
};

type FreightPayload = {
  periods: PeriodRow[];
  periodId: string | null;
  activities: ActivityRow[];
  canEdit: boolean;
  computation: Computation | null;
  computeError: string | null;
  message?: string;
  error?: string;
};

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function sumByPrefix(computation: Computation | null, prefix: string): number {
  if (!computation) return 0;
  return computation.components
    .filter((c) => c.key.startsWith(prefix))
    .reduce((sum, c) => sum + c.valueTco2e, 0);
}

export function FreightClient() {
  const [periodId, setPeriodId] = useState<string>("");
  const [payload, setPayload] = useState<FreightPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback((nextPeriodId?: string) => {
    startTransition(async () => {
      setError(null);
      setSaveMessage(null);
      const q = nextPeriodId ? `?periodId=${encodeURIComponent(nextPeriodId)}` : "";
      const res = await fetch(`/api/app/scope3/freight${q}`);
      const data = (await res.json().catch(() => ({}))) as FreightPayload;
      if (!res.ok) {
        setError(data.error ?? "Could not load freight data.");
        setPayload(null);
        return;
      }
      setPayload(data);
      if (data.periodId) setPeriodId(data.periodId);
      const nextDrafts: Record<string, string> = {};
      for (const row of data.activities ?? []) {
        nextDrafts[row.metricKey] =
          row.value === null || row.value === undefined ? "" : String(row.value);
      }
      setDrafts(nextDrafts);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    if (!payload?.periodId || !payload.canEdit) return;
    startTransition(async () => {
      setError(null);
      setSaveMessage(null);
      const activities = (payload.activities ?? []).map((row) => {
        const raw = drafts[row.metricKey]?.trim() ?? "";
        if (raw === "") return { metricKey: row.metricKey, value: null };
        const value = Number(raw);
        return { metricKey: row.metricKey, value };
      });

      const res = await fetch("/api/app/scope3/freight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: payload.periodId, activities }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        written?: unknown[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save freight activity.");
        return;
      }
      setSaveMessage(`Saved ${data.written?.length ?? 0} datapoints.`);
      if (payload.periodId) load(payload.periodId);
    });
  };

  const upstream = payload?.activities.filter((a) => a.group === "upstream") ?? [];
  const downstream = payload?.activities.filter((a) => a.group === "downstream") ?? [];
  const computation = payload?.computation;
  const upstreamTco2e = sumByPrefix(computation ?? null, "freight_upstream_");
  const downstreamTco2e = sumByPrefix(computation ?? null, "freight_downstream_");

  return (
    <PageFrame
      eyebrow="Scope 3"
      title="Freight & logistics"
      help="Cat 4 upstream and Cat 9 downstream freight as mode × tonne-km. Values write to datapoints; factors come from the emission-factor registry only."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/scope3/travel"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Travel & commute
          </Link>
          <Link
            href={METRICS_HREF}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Metrics grid
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => load(periodId)}
            disabled={pending}
          >
            Refresh
          </Button>
          {payload?.canEdit ? (
            <Button type="button" onClick={save} disabled={pending || !payload.periodId}>
              Save
            </Button>
          ) : null}
        </div>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {payload?.computeError ? (
        <StatusLine tone="error">{payload.computeError}</StatusLine>
      ) : null}
      {saveMessage ? <StatusLine tone="ok">{saveMessage}</StatusLine> : null}

      {!payload && !error ? (
        <EmptyState title="Loading" body="Loading freight activity…" />
      ) : null}

      {payload && payload.periods.length === 0 ? (
        <EmptyState
          title="No reporting period"
          body={
            payload.message ??
            "Create a reporting period under Metrics before entering freight data."
          }
        />
      ) : null}

      {payload && payload.periods.length > 0 ? (
        <div className="space-y-6">
          <PageCard>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Reporting period
            </label>
            <select
              className="mt-2 w-full max-w-md rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
              value={periodId}
              onChange={(e) => {
                const next = e.target.value;
                setPeriodId(next);
                load(next);
              }}
              disabled={pending}
            >
              {payload.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.status})
                </option>
              ))}
            </select>
          </PageCard>

          <div className="grid gap-4 sm:grid-cols-4">
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Cat 4 + 9 total
              </p>
              <div className="mt-2">
                {computation ? (
                  <Metric
                    value={computation.totalTco2e}
                    unit="tCO₂e"
                    size="xl"
                    decimals={2}
                  />
                ) : (
                  <p className="font-data text-2xl text-ink-muted">—</p>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Quality: {computation?.quality ?? "missing"}
              </p>
            </PageCard>
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Cat 4 upstream
              </p>
              <p className="mt-2 font-data text-2xl text-ink">
                {formatNum(upstreamTco2e)}
              </p>
              <p className="mt-2 text-xs text-ink-muted">tCO₂e · company-paid freight</p>
            </PageCard>
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Cat 9 downstream
              </p>
              <p className="mt-2 font-data text-2xl text-ink">
                {formatNum(downstreamTco2e)}
              </p>
              <p className="mt-2 text-xs text-ink-muted">tCO₂e · sold-product freight</p>
            </PageCard>
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Missing inputs
              </p>
              <p className="mt-2 font-data text-2xl text-ink">
                {computation?.missingInputs.length ?? 0}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                Absent modes are not treated as zero
              </p>
            </PageCard>
          </div>

          <ActivitySection
            title="Cat 4 — upstream transportation"
            help="Freight paid or controlled by the reporting company (inbound logistics and company-paid outbound). Enter tonne-km = tonnes × km."
            rows={upstream}
            drafts={drafts}
            setDrafts={setDrafts}
            canEdit={Boolean(payload.canEdit)}
            pending={pending}
          />

          <ActivitySection
            title="Cat 9 — downstream transportation"
            help="Distribution of sold products after the point of sale, typically paid by the customer or a third party. Same mode factors as Cat 4; category is encoded on the metric."
            rows={downstream}
            drafts={drafts}
            setDrafts={setDrafts}
            canEdit={Boolean(payload.canEdit)}
            pending={pending}
          />

          <PageCard>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Calculated components
            </h2>
            {!computation || computation.components.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                No freight activity in this period yet.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-rule">
                {computation.components.map((c) => (
                  <div
                    key={c.key}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="text-sm text-ink">{c.label}</p>
                      <p className="text-[11px] text-ink-muted">
                        Factor {c.factorKey}: {formatNum(c.factorValue)} {c.factorUnit}
                      </p>
                    </div>
                    <p className="font-data text-sm text-ink">
                      {formatNum(c.valueTco2e)} tCO₂e
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PageCard>
        </div>
      ) : null}
    </PageFrame>
  );
}

function ActivitySection(props: {
  title: string;
  help: string;
  rows: ActivityRow[];
  drafts: Record<string, string>;
  setDrafts: (
    next:
      Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  canEdit: boolean;
  pending: boolean;
}) {
  if (props.rows.length === 0) return null;

  return (
    <PageCard>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {props.title}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{props.help}</p>
      <div className="mt-4 space-y-3">
        {props.rows.map((row) => (
          <div
            key={row.metricKey}
            className="grid gap-2 border-t border-rule pt-3 sm:grid-cols-[1fr_160px] sm:items-end"
          >
            <div>
              <p className="text-sm text-ink">{row.label}</p>
              <p className="text-[11px] text-ink-muted">
                {row.metricKey} · {row.unit}
              </p>
            </div>
            <div>
              <label className="sr-only" htmlFor={`freight-${row.metricKey}`}>
                {row.label}
              </label>
              <input
                id={`freight-${row.metricKey}`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                disabled={!props.canEdit || props.pending}
                value={props.drafts[row.metricKey] ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  props.setDrafts((prev) => ({ ...prev, [row.metricKey]: value }));
                }}
                className={cn(
                  "w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 font-data text-sm text-ink",
                  "disabled:opacity-60",
                )}
                placeholder="—"
              />
            </div>
          </div>
        ))}
      </div>
    </PageCard>
  );
}
