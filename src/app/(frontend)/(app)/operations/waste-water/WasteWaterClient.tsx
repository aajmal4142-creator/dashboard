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
  group: "water" | "waste" | "waste_legacy";
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

type Intensity = {
  value: number | null;
  unit: string;
  quality: string;
  explanation?: string;
};

type WasteComputation = {
  totalTco2e: number;
  quality: string;
  emissionsComputed: boolean;
  components: Array<{
    key: string;
    label: string;
    valueTco2e: number;
    factorKey: string;
    factorValue: number;
    factorUnit: string;
  }>;
  missingInputs: string[];
  missingFactors: string[];
};

type WasteWaterPayload = {
  periods: PeriodRow[];
  periodId: string | null;
  activities: ActivityRow[];
  coverageGaps: string[];
  canEdit: boolean;
  wasteComputation: WasteComputation | null;
  waterIntensity: Intensity | null;
  diversionRate: Intensity | null;
  employeesFte: number | null;
  message?: string;
  error?: string;
};

type TabId = "waste" | "water";

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function WasteWaterClient() {
  const [tab, setTab] = useState<TabId>("waste");
  const [periodId, setPeriodId] = useState<string>("");
  const [payload, setPayload] = useState<WasteWaterPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback((nextPeriodId?: string) => {
    startTransition(async () => {
      setError(null);
      setSaveMessage(null);
      const q = nextPeriodId ? `?periodId=${encodeURIComponent(nextPeriodId)}` : "";
      const res = await fetch(`/api/app/operations/waste-water${q}`);
      const data = (await res.json().catch(() => ({}))) as WasteWaterPayload;
      if (!res.ok) {
        setError(data.error ?? "Could not load waste and water data.");
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

      const res = await fetch("/api/app/operations/waste-water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: payload.periodId, activities }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        written?: unknown[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save waste and water activity.");
        return;
      }
      setSaveMessage(`Saved ${data.written?.length ?? 0} datapoints.`);
      if (payload.periodId) load(payload.periodId);
    });
  };

  const waterRows = payload?.activities.filter((a) => a.group === "water") ?? [];
  const wasteRows = payload?.activities.filter((a) => a.group === "waste") ?? [];
  const legacyRows = payload?.activities.filter((a) => a.group === "waste_legacy") ?? [];
  const computation = payload?.wasteComputation;
  const tabGaps =
    payload?.coverageGaps.filter((key) => {
      const row = payload.activities.find((a) => a.metricKey === key);
      if (!row) return false;
      return tab === "water" ? row.group === "water" : row.group === "waste";
    }) ?? [];

  return (
    <PageFrame
      eyebrow="Operations"
      title="Waste & water"
      help="Operational E metrics for ESRS E3/E5 style water and waste. Values write to datapoints. Scope 3 Cat 5 GHG applies only when disposal factors are seeded — otherwise activity stays operational."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={METRICS_HREF}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Metrics grid
          </Link>
          <Link
            href="/iot"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            IoT water
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
      {saveMessage ? <StatusLine tone="ok">{saveMessage}</StatusLine> : null}

      {!payload && !error ? (
        <EmptyState title="Loading" body="Loading waste and water activity…" />
      ) : null}

      {payload && payload.periods.length === 0 ? (
        <EmptyState
          title="No reporting period"
          body={
            payload.message ??
            "Create a reporting period under Metrics before entering waste or water data."
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

          <div
            className="flex gap-0 border-b border-rule"
            role="tablist"
            aria-label="Waste and water"
          >
            {(
              [
                { id: "waste" as const, label: "Waste" },
                { id: "water" as const, label: "Water" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm transition-colors",
                  tab === item.id
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tabGaps.length > 0 ? (
            <StatusLine tone="neutral">
              Coverage gaps ({tabGaps.length}): {tabGaps.join(", ")}. Enter values here or
              in{" "}
              <Link href={METRICS_HREF} className="underline underline-offset-2">
                Metrics
              </Link>
              .
            </StatusLine>
          ) : (
            <StatusLine tone="ok">
              No coverage gaps on this tab for the period.
            </StatusLine>
          )}

          {tab === "waste" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <PageCard>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Cat 5 total
                  </p>
                  <div className="mt-2">
                    {computation?.emissionsComputed ? (
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
                    {computation?.emissionsComputed
                      ? `Quality: ${computation.quality}`
                      : "Operational only — disposal factors not applied"}
                  </p>
                </PageCard>
                <PageCard>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Diversion rate
                  </p>
                  <div className="mt-2">
                    {payload.diversionRate?.value !== null &&
                    payload.diversionRate?.value !== undefined ? (
                      <Metric
                        value={payload.diversionRate.value}
                        unit="%"
                        size="xl"
                        decimals={1}
                      />
                    ) : (
                      <p className="font-data text-2xl text-ink-muted">—</p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">
                    {payload.diversionRate?.explanation ?? "Recycled ÷ generated"}
                  </p>
                </PageCard>
                <PageCard>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Missing factors
                  </p>
                  <p className="mt-2 font-data text-2xl text-ink">
                    {computation?.missingFactors.length ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    Present tonnes without a registry factor stay non-GHG
                  </p>
                </PageCard>
              </div>

              <ActivitySection
                title="Waste generated and disposal"
                help="Prefer waste_generated_tonnes. Landfill and recycling feed optional Cat 5 when factors are seeded."
                rows={wasteRows}
                drafts={drafts}
                setDrafts={setDrafts}
                canEdit={Boolean(payload.canEdit)}
                pending={pending}
              />

              <ActivitySection
                title="Legacy aggregate"
                help="Supplier questionnaire waste_tonnes. Used as generated fallback when waste_generated_tonnes is blank."
                rows={legacyRows}
                drafts={drafts}
                setDrafts={setDrafts}
                canEdit={Boolean(payload.canEdit)}
                pending={pending}
              />

              <PageCard>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Cat 5 components
                </h2>
                {!computation || computation.components.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    No Cat 5 emissions for this period. Enter disposal tonnes and ensure
                    waste factors are seeded, or track operational tonnes only.
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
                            Factor {c.factorKey}: {formatNum(c.factorValue)}{" "}
                            {c.factorUnit}
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
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <PageCard>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Withdrawal intensity
                  </p>
                  <div className="mt-2">
                    {payload.waterIntensity?.value !== null &&
                    payload.waterIntensity?.value !== undefined ? (
                      <Metric
                        value={payload.waterIntensity.value}
                        unit={payload.waterIntensity.unit}
                        size="xl"
                        decimals={2}
                      />
                    ) : (
                      <p className="font-data text-2xl text-ink-muted">—</p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">
                    {payload.waterIntensity?.explanation ??
                      `Requires ${payload.employeesFte != null ? "withdrawal" : "employees_total (FTE)"} in Metrics`}
                  </p>
                </PageCard>
                <PageCard>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Employees (FTE)
                  </p>
                  <p className="mt-2 font-data text-2xl text-ink">
                    {payload.employeesFte != null ? formatNum(payload.employeesFte) : "—"}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    From{" "}
                    <Link href={METRICS_HREF} className="underline underline-offset-2">
                      Metrics
                    </Link>{" "}
                    · employees_total
                  </p>
                </PageCard>
              </div>

              <ActivitySection
                title="Water withdrawal and discharge"
                help="Operational water for ESRS E3 / BRSR style disclosure. IoT utility_water can feed meters separately."
                rows={waterRows}
                drafts={drafts}
                setDrafts={setDrafts}
                canEdit={Boolean(payload.canEdit)}
                pending={pending}
              />
            </>
          )}
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
                {row.metricKey} · {row.unit} · {row.quality}
              </p>
            </div>
            <div>
              <label className="sr-only" htmlFor={`ww-${row.metricKey}`}>
                {row.label}
              </label>
              <input
                id={`ww-${row.metricKey}`}
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
