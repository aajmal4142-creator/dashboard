"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";

import { PageCard, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { AppField } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { INDUSTRY_INTENSITY_BY_NACE } from "@/lib/suppliers/industryIntensity";

type CascadeNode = {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  attributableEmissions: number;
  estimationMethod: "actual" | "industry_avg" | "top_down";
  confidence: "high" | "medium" | "low";
  estimated: boolean;
  spend: number;
  naceCode: string | null;
  allocationPct: number;
};

type Cascade = {
  tier1Id: string;
  tier1Name: string;
  tier1Direct: CascadeNode;
  tier2: CascadeNode[];
  tier3: CascadeNode[];
  tier2Total: number;
  tier3Total: number;
  totalCategory1ForSupplier: number;
  actualVsEstimated: {
    actual: number | null;
    estimated: number | null;
    delta: number | null;
  };
};

function formatNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function confidenceLabel(c: string): string {
  if (c === "high") return "High (actual)";
  if (c === "medium") return "Medium (top-down)";
  return "Low (industry avg)";
}

function confidenceTone(c: string): string {
  if (c === "high") return "text-signal";
  if (c === "medium") return "text-amber";
  return "text-rust";
}

function BreakdownBars({ cascade }: { cascade: Cascade }) {
  const total = cascade.totalCategory1ForSupplier;
  const rows = [
    {
      label: "Tier 1 direct",
      value: cascade.tier1Direct.attributableEmissions,
      conf: cascade.tier1Direct.confidence,
      estimated: cascade.tier1Direct.estimated,
    },
    {
      label: "Tier 2 upstream",
      value: cascade.tier2Total,
      conf: cascade.tier2.some((n) => n.confidence === "high") ? "high" : "low",
      estimated: cascade.tier2.some((n) => n.estimated),
    },
    {
      label: "Tier 3 upstream",
      value: cascade.tier3Total,
      conf: cascade.tier3.some((n) => n.confidence === "high") ? "high" : "low",
      estimated:
        cascade.tier3.length === 0 ? false : cascade.tier3.some((n) => n.estimated),
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">
                {row.label}
                {row.estimated ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-muted">
                    estimated
                  </span>
                ) : (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-signal">
                    actual
                  </span>
                )}
              </span>
              <span className="font-data text-ink">{formatNum(row.value)} tCO₂e</span>
            </div>
            <div className="h-2 overflow-hidden rounded-[2px] bg-surface-2">
              <div
                className="h-full rounded-[2px] bg-accent"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                role="presentation"
              />
            </div>
            <p className={`mt-0.5 text-[11px] ${confidenceTone(row.conf)}`}>
              Confidence: {confidenceLabel(row.conf)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function TierEmissionsClient({
  supplier,
  canWrite,
}: {
  supplier: {
    id: string;
    name: string;
    contactEmail: string;
    tier: number | null;
    directSpend: number | null;
    annualSpend: number | null;
    naceCode: string | null;
    industryIntensityOverride: number | null;
    estimatedEmissions: number | null;
    estimationMethod: string | null;
    estimationConfidence: string | null;
    emailConsent: boolean;
  };
  canWrite: boolean;
}) {
  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();
  const [naceCode, setNaceCode] = useState(supplier.naceCode ?? "");
  const [directSpend, setDirectSpend] = useState(
    supplier.directSpend != null
      ? String(supplier.directSpend)
      : supplier.annualSpend != null
        ? String(supplier.annualSpend)
        : "",
  );
  const [intensityOverride, setIntensityOverride] = useState(
    supplier.industryIntensityOverride != null
      ? String(supplier.industryIntensityOverride)
      : "",
  );

  const note = useCallback(
    (message: string, tone: "neutral" | "error" | "ok" = "neutral") => {
      setStatusTone(tone);
      setStatus(message);
    },
    [],
  );

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch(`/api/app/suppliers/${supplier.id}/tier-2-emissions`);
      const data = (await res.json().catch(() => ({}))) as {
        cascade?: Cascade;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (data.code === "MISSING_NACE") {
          note(data.error ?? "NACE industry code required.", "error");
          setCascade(null);
          return;
        }
        note(data.error ?? "Could not load Tier 2 emissions.", "error");
        return;
      }
      setCascade(data.cascade ?? null);
      setStatus(null);
    });
  }, [supplier.id, note]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMeta() {
    if (!canWrite) {
      note("Viewers cannot edit supplier industry data.", "error");
      return;
    }
    if (!naceCode.trim() && !intensityOverride.trim()) {
      note(
        "Enter a NACE industry code (or intensity override). Industry is never assumed.",
        "error",
      );
      return;
    }
    note("Saving…");
    const res = await fetch(`/api/app/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naceCode: naceCode.trim() || null,
        directSpend: directSpend === "" ? null : Number(directSpend),
        industryIntensityOverride:
          intensityOverride === "" ? null : Number(intensityOverride),
        tier: 1,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      note(data.error ?? "Could not save.", "error");
      return;
    }
    note("Saved. Run estimate to refresh Tier 2 figures.", "ok");
  }

  async function runEstimate() {
    if (!canWrite) {
      note("Viewers cannot run estimates.", "error");
      return;
    }
    if (!naceCode.trim() && !intensityOverride.trim()) {
      note(
        "Ask the supplier for their NACE code before estimating. Do not invent one.",
        "error",
      );
      return;
    }
    await saveMeta();
    note("Estimating Tier 2/3…");
    const res = await fetch(`/api/app/suppliers/${supplier.id}/tier-2-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowTopDown: true }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      cascade?: Cascade;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      note(data.error ?? "Estimate failed.", "error");
      return;
    }
    setCascade(data.cascade ?? null);
    note("Tier 2/3 estimate updated.", "ok");
  }

  async function sendSurvey() {
    if (!canWrite) {
      note("Viewers cannot send surveys.", "error");
      return;
    }
    note("Sending Tier 2 survey…");
    const res = await fetch(`/api/app/suppliers/${supplier.id}/tier-2-survey`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      delivery?: string;
      link?: string;
    };
    if (!res.ok) {
      note(data.error ?? "Survey not sent.", "error");
      return;
    }
    note(
      data.delivery === "resend"
        ? "Survey email sent."
        : "Survey logged to console (no RESEND_API_KEY).",
      "ok",
    );
  }

  const av = cascade?.actualVsEstimated;

  return (
    <PageFrame
      eyebrow="Scope 3 · Category 1"
      title={supplier.name}
      help="Hybrid Tier 2/3 estimate: actual emissions when known, otherwise spend × industry intensity × allocation. Confidence always shown. NACE is never assumed."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/scope3/category-1"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Category 1 breakdown
          </Link>
          <Link
            href="/suppliers/supply-chain"
            className="text-sm text-ink-muted underline-offset-2 hover:underline"
          >
            Supply chain map
          </Link>
        </div>
      }
    >
      {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <PageCard>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Industry & spend
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Ask the supplier for their NACE code. ClearESG will not invent one.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AppField
                label="NACE code"
                value={naceCode}
                onChange={(e) => setNaceCode(e.target.value)}
                placeholder="e.g. C or 24"
                disabled={!canWrite}
              />
              <AppField
                label="Direct spend (USD)"
                value={directSpend}
                onChange={(e) => setDirectSpend(e.target.value)}
                inputMode="decimal"
                disabled={!canWrite}
              />
              <AppField
                label="Intensity override (tCO₂e / $M)"
                value={intensityOverride}
                onChange={(e) => setIntensityOverride(e.target.value)}
                inputMode="decimal"
                disabled={!canWrite}
                placeholder="Optional — skips bundled NACE table"
              />
              <div>
                <p className="mb-1 text-[11px] font-medium text-ink-muted">
                  Section baselines
                </p>
                <select
                  className="w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink"
                  value=""
                  disabled={!canWrite}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setNaceCode(v);
                  }}
                  aria-label="Pick NACE section"
                >
                  <option value="">Select section to fill NACE…</option>
                  {INDUSTRY_INTENSITY_BY_NACE.filter((r) => r.naceCode.length === 1).map(
                    (r) => (
                      <option key={r.naceCode} value={r.naceCode}>
                        {r.naceCode} — {r.label} ({r.tco2ePerMillionUsd} t/$M)
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void saveMeta()}
                disabled={!canWrite || pending}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => void runEstimate()}
                disabled={!canWrite || pending}
              >
                Estimate Tier 2 emissions
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void sendSurvey()}
                disabled={!canWrite || pending || !supplier.emailConsent}
              >
                Send Tier 2 survey
              </Button>
            </div>
            {!supplier.emailConsent ? (
              <p className="mt-2 text-[12px] text-ink-muted">
                Survey requires email consent on the supplier record.
              </p>
            ) : null}
          </PageCard>

          <PageCard>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Breakdown
            </h2>
            {cascade ? (
              <div className="mt-4">
                <BreakdownBars cascade={cascade} />
                <p className="mt-4 border-t border-rule pt-3 text-sm text-ink">
                  Total Category 1 for this supplier:{" "}
                  <span className="font-data font-semibold">
                    {formatNum(cascade.totalCategory1ForSupplier)} tCO₂e
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-ink-muted">
                Save NACE and run estimate to see Tier 1 / 2 / 3 split.
              </p>
            )}
          </PageCard>

          {cascade && (cascade.tier2.length > 0 || cascade.tier3.length > 0) ? (
            <PageCard>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Upstream nodes
              </h2>
              <ul className="mt-3 divide-y divide-rule">
                {[...cascade.tier2, ...cascade.tier3].map((n) => (
                  <li
                    key={n.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <span className="text-ink">{n.name}</span>
                      <span className="ml-2 text-[11px] text-ink-muted">
                        Tier {n.tier}
                        {n.estimated ? " · estimated" : " · actual"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-data text-ink">
                        {formatNum(n.attributableEmissions)} tCO₂e
                      </span>
                      <p className={`text-[11px] ${confidenceTone(n.confidence)}`}>
                        {confidenceLabel(n.confidence)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </PageCard>
          ) : null}
        </div>

        <aside className="space-y-5">
          <PageCard>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Tier 1 direct
            </p>
            <div className="mt-2">
              <Metric
                value={
                  cascade?.tier1Direct.attributableEmissions ??
                  supplier.estimatedEmissions ??
                  0
                }
                unit="tCO₂e"
                size="xl"
                decimals={1}
              />
            </div>
            {cascade ? (
              <p
                className={`mt-2 text-[12px] ${confidenceTone(cascade.tier1Direct.confidence)}`}
              >
                {confidenceLabel(cascade.tier1Direct.confidence)}
              </p>
            ) : null}
          </PageCard>

          <PageCard>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              From Tier 2
            </p>
            <div className="mt-2">
              <Metric
                value={cascade?.tier2Total ?? 0}
                unit="tCO₂e"
                size="lg"
                decimals={1}
              />
            </div>
          </PageCard>

          {av && (av.actual != null || av.estimated != null) ? (
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Actual vs estimated
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Actual</dt>
                  <dd className="font-data text-ink">
                    {av.actual != null ? `${formatNum(av.actual)} t` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Industry estimate</dt>
                  <dd className="font-data text-ink">
                    {av.estimated != null ? `${formatNum(av.estimated)} t` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-rule pt-2">
                  <dt className="text-ink-muted">Delta</dt>
                  <dd className="font-data text-ink">
                    {av.delta != null ? `${formatNum(av.delta)} t` : "—"}
                  </dd>
                </div>
              </dl>
            </PageCard>
          ) : null}
        </aside>
      </div>
    </PageFrame>
  );
}
