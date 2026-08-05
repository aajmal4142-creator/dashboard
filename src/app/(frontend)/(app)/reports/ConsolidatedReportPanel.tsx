"use client";

import { useEffect, useState, useTransition } from "react";
import { Download } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { EmptyState, PageCard, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CONSOLIDATION_METHOD_LABELS } from "@/lib/consolidation/consolidate";
import { cn } from "@/lib/utils";

type ConsolidationQuality = "measured" | "partial" | "missing";

type ConsolidatedOrg = {
  organisationId: string;
  organisationName: string;
  depth: number;
  ownershipPercent: number;
  pathFactor: number;
  consolidationMethod: keyof typeof CONSOLIDATION_METHOD_LABELS;
  consolidated: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
  };
  hasData: boolean;
};

type ConsolidationPack = "management" | "statutory";

type EliminationRow = {
  label: string;
  scope1: string;
  scope2: string;
  scope3: string;
  note: string;
};

function emptyEliminationRow(): EliminationRow {
  return { label: "", scope1: "", scope2: "", scope3: "", note: "" };
}

type ConsolidatedPayload = {
  period: string;
  pack: ConsolidationPack;
  total: number | null;
  by_scope: {
    scope1: number | null;
    scope2: number | null;
    scope3: number | null;
  };
  by_org: ConsolidatedOrg[];
  by_category: Array<{ category: string; emissions: number }>;
  unconsolidated_child_list: Array<{
    organisationId: string;
    organisationName: string;
    reason: string;
  }>;
  methods_used: Array<keyof typeof CONSOLIDATION_METHOD_LABELS>;
  warnings: string[];
  footer: string;
  has_subsidiaries: boolean;
  quality: ConsolidationQuality;
  measured_org_count: number;
  missing_org_count: number;
  quality_message: string | null;
  error?: string;
};

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function qualityLabel(quality: ConsolidationQuality, t: (key: string) => string): string {
  if (quality === "measured") return t("consolidation.qualityMeasured");
  if (quality === "partial") return t("consolidation.qualityPartial");
  return t("consolidation.qualityMissing");
}

export function ConsolidatedReportPanel({ defaultPeriod }: { defaultPeriod?: number }) {
  const { t } = useI18n();
  const year = defaultPeriod ?? new Date().getFullYear();
  const [includeSubsidiaries, setIncludeSubsidiaries] = useState(false);
  const [period, setPeriod] = useState(String(year));
  const [pack, setPack] = useState<ConsolidationPack>("management");
  const [eliminations, setEliminations] = useState<EliminationRow[]>([]);
  const [data, setData] = useState<ConsolidatedPayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  function eliminationsQueryValue(): string | null {
    const rows = eliminations
      .filter((r) => r.label.trim())
      .map((r) => ({
        label: r.label.trim(),
        scope1: r.scope1 ? Number(r.scope1) : 0,
        scope2: r.scope2 ? Number(r.scope2) : 0,
        scope3: r.scope3 ? Number(r.scope3) : 0,
        note: r.note.trim() || null,
      }));
    return rows.length > 0 ? JSON.stringify(rows) : null;
  }

  function buildQuery(extra?: Record<string, string>): string {
    const params = new URLSearchParams({ period, pack, ...extra });
    const elimJson = eliminationsQueryValue();
    if (elimJson) params.set("eliminations", elimJson);
    return params.toString();
  }

  function load() {
    startTransition(async () => {
      if (!includeSubsidiaries) {
        setData(null);
        setStatus(null);
        return;
      }
      setStatus(t("consolidation.loading"));
      setStatusTone("neutral");
      try {
        const res = await fetch(`/api/app/reports/consolidated?${buildQuery()}`);
        const json = (await res.json()) as ConsolidatedPayload;
        if (!res.ok) {
          setStatus(json.error ?? t("consolidation.errorLoad"));
          setStatusTone("error");
          setData(null);
          return;
        }
        setData(json);
        if (!json.has_subsidiaries) {
          setStatus(t("consolidation.noSubsidiaries", { period: json.period }));
          setStatusTone("neutral");
        } else if (json.quality === "missing") {
          setStatus(json.quality_message ?? t("consolidation.totalUnavailable"));
          setStatusTone("neutral");
        } else {
          setStatus(
            t("consolidation.loadedSummary", {
              period: json.period,
              total: fmt(json.total),
              quality: qualityLabel(json.quality, t),
            }),
          );
          setStatusTone(json.quality === "partial" ? "neutral" : "ok");
        }
      } catch {
        setStatus(t("consolidation.errorNetwork"));
        setStatusTone("error");
      }
    });
  }

  useEffect(() => {
    void Promise.resolve().then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when toggle/period/pack change
  }, [includeSubsidiaries, period, pack]);

  async function downloadCsv() {
    try {
      const res = await fetch(
        `/api/app/reports/consolidated?${buildQuery({ format: "csv" })}`,
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(json.error ?? t("consolidation.errorCsv"));
        setStatusTone("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consolidated-${period}-${pack}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus(t("consolidation.errorCsvNetwork"));
      setStatusTone("error");
    }
  }

  function addEliminationRow() {
    setEliminations((rows) => [...rows, emptyEliminationRow()]);
  }

  function updateEliminationRow(index: number, patch: Partial<EliminationRow>) {
    setEliminations((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeEliminationRow(index: number) {
    setEliminations((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <PageCard title={t("consolidation.title")}>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
          <Checkbox
            checked={includeSubsidiaries}
            onCheckedChange={(v) => setIncludeSubsidiaries(v === true)}
          />
          {t("consolidation.includeSubsidiaries")}
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-muted">
          {t("consolidation.period")}
          <input
            type="number"
            className="w-20 rounded-[4px] border border-rule bg-surface-1 px-2 py-1 font-data text-sm text-ink"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            min={1990}
            max={2100}
            disabled={!includeSubsidiaries || pending}
          />
        </label>
        <div className="flex items-center gap-2 text-[12px] text-ink-muted">
          {t("consolidation.packLabel")}
          <div className="flex overflow-hidden rounded-[4px] border border-rule">
            {(["management", "statutory"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={!includeSubsidiaries || pending}
                onClick={() => setPack(p)}
                className={cn(
                  "px-2.5 py-1 text-[12px] transition-colors",
                  pack === p
                    ? "bg-accent text-white"
                    : "bg-surface-1 text-ink-muted hover:text-ink",
                )}
              >
                {p === "management"
                  ? t("consolidation.packManagement")
                  : t("consolidation.packStatutory")}
              </button>
            ))}
          </div>
        </div>
        {includeSubsidiaries ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void downloadCsv()}
          >
            <Download className="mr-1.5 size-3.5" aria-hidden />
            {t("consolidation.exportCsv")}
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-ink-muted">
        {t("consolidation.help")}{" "}
        <a href="/settings/org-hierarchy" className="editorial-link text-accent">
          {t("consolidation.manageHierarchy")}
        </a>
      </p>
      {pack === "statutory" ? (
        <p className="mt-1 text-[12px] text-amber">{t("consolidation.packHelp")}</p>
      ) : null}

      {includeSubsidiaries ? (
        <div className="mt-4 space-y-2 border-t border-rule pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              {t("consolidation.eliminationsTitle")}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={addEliminationRow}>
              {t("consolidation.eliminationsAdd")}
            </Button>
          </div>
          <p className="text-[12px] text-ink-muted">
            {t("consolidation.eliminationsHelp")}
          </p>
          {eliminations.length > 0 ? (
            <div className="space-y-2">
              {eliminations.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    className="min-w-[180px] flex-1 rounded-[4px] border border-rule bg-surface-1 px-2 py-1 text-[13px] text-ink"
                    placeholder={t("consolidation.eliminationsLabelPlaceholder")}
                    value={row.label}
                    onChange={(e) => updateEliminationRow(i, { label: e.target.value })}
                  />
                  {(["scope1", "scope2", "scope3"] as const).map((scopeKey) => (
                    <input
                      key={scopeKey}
                      type="number"
                      className="w-24 rounded-[4px] border border-rule bg-surface-1 px-2 py-1 font-data text-[13px] text-ink"
                      placeholder={t(`consolidation.${scopeKey}`)}
                      value={row[scopeKey]}
                      onChange={(e) =>
                        updateEliminationRow(i, { [scopeKey]: e.target.value })
                      }
                    />
                  ))}
                  <input
                    type="text"
                    className="min-w-[140px] flex-1 rounded-[4px] border border-rule bg-surface-1 px-2 py-1 text-[13px] text-ink"
                    placeholder={t("consolidation.eliminationsNotePlaceholder")}
                    value={row.note}
                    onChange={(e) => updateEliminationRow(i, { note: e.target.value })}
                  />
                  <button
                    type="button"
                    className="text-[12px] text-rust"
                    onClick={() => removeEliminationRow(i)}
                  >
                    {t("consolidation.eliminationsRemove")}
                  </button>
                </div>
              ))}
              <Button type="button" size="sm" disabled={pending} onClick={() => load()}>
                {t("consolidation.eliminationsApply")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!includeSubsidiaries ? (
        <div className="mt-5">
          <EmptyState
            title={t("consolidation.toggleOffTitle")}
            body={t("consolidation.toggleOffBody")}
          />
        </div>
      ) : null}

      {status ? (
        <div className="mt-3">
          <StatusLine tone={statusTone}>{status}</StatusLine>
        </div>
      ) : null}

      {includeSubsidiaries && data ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule pb-3">
            <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              {t("consolidation.quality")}
            </p>
            <p
              className={cn(
                "font-data text-sm",
                data.quality === "measured"
                  ? "text-ink"
                  : data.quality === "partial"
                    ? "text-amber"
                    : "text-rust",
              )}
            >
              {qualityLabel(data.quality, t)}
            </p>
            <p className="font-data text-[12px] text-ink-muted">
              {t("consolidation.entityCounts", {
                measured: data.measured_org_count,
                missing: data.missing_org_count,
              })}
            </p>
          </div>

          {data.quality_message ? (
            <p className="text-[12px] text-ink-muted">{data.quality_message}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                [t("consolidation.total"), data.total],
                [t("consolidation.scope1"), data.by_scope.scope1],
                [t("consolidation.scope2"), data.by_scope.scope2],
                [t("consolidation.scope3"), data.by_scope.scope3],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border-b border-rule pb-2">
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                  {label}
                </p>
                <p
                  className={cn(
                    "mt-1 font-data text-lg",
                    value === null ? "text-amber" : "text-ink",
                  )}
                >
                  {fmt(value)}
                </p>
              </div>
            ))}
          </div>

          {data.warnings.length > 0 ? (
            <ul className="space-y-1 border border-amber/40 bg-amber/10 px-3 py-2 text-[12px] text-ink">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {data.unconsolidated_child_list.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                {t("consolidation.missingEntities")}
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {data.unconsolidated_child_list.map((u) => (
                  <li
                    key={u.organisationId}
                    className="flex justify-between gap-4 border-b border-rule py-1.5"
                  >
                    <span className="text-ink">{u.organisationName}</span>
                    <span className="text-[12px] text-amber">{u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              {t("consolidation.breakdown")}
            </p>
            {!data.has_subsidiaries && data.by_org.length <= 1 ? (
              <p className="mt-2 text-[13px] text-ink-muted">
                {t("consolidation.singleEntityNote")}
              </p>
            ) : null}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                    <th className="py-2 pr-3 font-medium">
                      {t("consolidation.colOrganisation")}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t("consolidation.colMethod")}
                    </th>
                    <th className="py-2 pr-3 font-medium">{t("consolidation.colOwn")}</th>
                    <th className="py-2 pr-3 font-medium">
                      {t("consolidation.colFactor")}
                    </th>
                    <th className="py-2 font-medium">{t("consolidation.colTco2e")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_org.map((row) => (
                    <tr key={row.organisationId} className="border-b border-rule">
                      <td
                        className="py-2 pr-3 text-ink"
                        style={{ paddingLeft: `${row.depth * 12}px` }}
                      >
                        {row.organisationName}
                        {!row.hasData ? (
                          <span className="ml-2 text-[11px] text-amber">
                            {t("consolidation.noData")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-[12px] text-ink-muted">
                        {row.depth === 0
                          ? "—"
                          : CONSOLIDATION_METHOD_LABELS[row.consolidationMethod]}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.depth === 0 ? "—" : `${row.ownershipPercent}%`}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.pathFactor.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-2 font-data",
                          row.hasData ? "text-ink" : "text-amber",
                        )}
                      >
                        {row.hasData ? fmt(row.consolidated.total) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.by_category.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                {t("consolidation.byCategory")}
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {data.by_category.slice(0, 12).map((c) => (
                  <li
                    key={c.category}
                    className="flex justify-between gap-4 border-b border-rule py-1.5"
                  >
                    <span className="text-ink">{c.category}</span>
                    <span className="font-data text-ink-muted">{fmt(c.emissions)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-rule pt-3 text-[12px] text-ink-muted">
            {data.footer}
          </p>
        </div>
      ) : null}
    </PageCard>
  );
}
