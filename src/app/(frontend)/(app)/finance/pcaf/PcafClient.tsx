"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  PCAF_ASSET_CLASSES,
  PCAF_DATA_SOURCE_LABEL,
  PCAF_DISCLAIMER,
  isPcafAssetClass,
  isPcafDataSource,
  type FinancedEmissionDto,
  type PcafAssetClass,
  type PcafDataSource,
  type PcafPortfolioSummary,
} from "@/lib/pcaf";
import { cn } from "@/lib/utils";

const ASSET_CLASS_LABEL: Record<PcafAssetClass, string> = {
  listed_equity_corporate_bonds: "Listed equity & corporate bonds",
  business_loans_unlisted_equity: "Business loans & unlisted equity",
  project_finance: "Project finance",
  commercial_real_estate: "Commercial real estate",
  motor_vehicle_loans: "Motor vehicle loans",
};

const DATA_SOURCE_OPTIONS: PcafDataSource[] = [
  "verified_reported",
  "unverified_reported",
  "physical_activity_primary",
  "physical_activity_proxy",
  "economic_activity_proxy",
];

type ListPayload = {
  exposures: FinancedEmissionDto[];
  summary: PcafPortfolioSummary;
  canWrite?: boolean;
  canDelete?: boolean;
  error?: string;
};

type FormState = {
  counterparty: string;
  assetClass: PcafAssetClass;
  outstandingAmount: string;
  evic: string;
  currency: string;
  borrowerScope1Tco2e: string;
  borrowerScope2Tco2e: string;
  borrowerScope3Tco2e: string;
  dataSource: PcafDataSource;
  notes: string;
};

function emptyForm(): FormState {
  return {
    counterparty: "",
    assetClass: "listed_equity_corporate_bonds",
    outstandingAmount: "",
    evic: "",
    currency: "USD",
    borrowerScope1Tco2e: "",
    borrowerScope2Tco2e: "",
    borrowerScope3Tco2e: "",
    dataSource: "economic_activity_proxy",
    notes: "",
  };
}

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
}

function qualityTone(quality: "measured" | "partial" | "missing"): string {
  if (quality === "measured") return "text-signal";
  if (quality === "partial") return "text-amber";
  return "text-rust";
}

export function PcafClient(props: {
  orgName: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/finance/pcaf");
        const json = (await res.json()) as ListPayload;
        if (!res.ok) {
          setError(json.error ?? "Could not load financed emissions");
          setPayload(null);
          return;
        }
        setPayload(json);
        if (selectedId && !json.exposures.some((e) => e.id === selectedId)) {
          setSelectedId(null);
        }
      } catch {
        setError("Network error loading financed emissions. Retry.");
        setPayload(null);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const canWrite = payload?.canWrite ?? props.canWrite;
  const canDelete = payload?.canDelete ?? props.canDelete;
  const selected = payload?.exposures.find((e) => e.id === selectedId) ?? null;
  const summary = payload?.summary;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(exposure: FinancedEmissionDto) {
    setEditingId(exposure.id);
    setForm({
      counterparty: exposure.counterparty,
      assetClass: exposure.assetClass,
      outstandingAmount: String(exposure.outstandingAmount),
      evic: exposure.evic === null ? "" : String(exposure.evic),
      currency: exposure.currency,
      borrowerScope1Tco2e:
        exposure.borrowerScope1Tco2e === null ? "" : String(exposure.borrowerScope1Tco2e),
      borrowerScope2Tco2e:
        exposure.borrowerScope2Tco2e === null ? "" : String(exposure.borrowerScope2Tco2e),
      borrowerScope3Tco2e:
        exposure.borrowerScope3Tco2e === null ? "" : String(exposure.borrowerScope3Tco2e),
      dataSource: exposure.dataSource,
      notes: exposure.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveExposure() {
    setFormError(null);
    if (!form.counterparty.trim()) {
      setFormError("Counterparty is required.");
      return;
    }
    const outstanding = Number(form.outstandingAmount);
    if (!Number.isFinite(outstanding) || outstanding < 0) {
      setFormError("Outstanding amount must be a non-negative number.");
      return;
    }
    if (!isPcafAssetClass(form.assetClass)) {
      setFormError("Select an asset class.");
      return;
    }
    if (!isPcafDataSource(form.dataSource)) {
      setFormError("Select a data source.");
      return;
    }

    function optNum(raw: string): number | null | undefined {
      const t = raw.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    }

    const evic = optNum(form.evic);
    const s1 = optNum(form.borrowerScope1Tco2e);
    const s2 = optNum(form.borrowerScope2Tco2e);
    const s3 = optNum(form.borrowerScope3Tco2e);
    if (evic === undefined || s1 === undefined || s2 === undefined || s3 === undefined) {
      setFormError("EVIC and borrower emissions must be numbers when provided.");
      return;
    }

    const body = {
      counterparty: form.counterparty.trim(),
      assetClass: form.assetClass,
      outstandingAmount: outstanding,
      evic,
      currency: form.currency,
      borrowerScope1Tco2e: s1,
      borrowerScope2Tco2e: s2,
      borrowerScope3Tco2e: s3,
      dataSource: form.dataSource,
      notes: form.notes.trim() || null,
    };

    const res = await fetch(
      editingId ? `/api/app/finance/pcaf/${editingId}` : "/api/app/finance/pcaf",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      exposure?: FinancedEmissionDto;
    };
    if (!res.ok) {
      setFormError(json.error ?? "Could not save exposure.");
      return;
    }
    setFormOpen(false);
    if (json.exposure) setSelectedId(json.exposure.id);
    load();
  }

  async function deleteExposure(id: string) {
    if (!canDelete) return;
    if (
      !window.confirm("Delete this financed-emissions exposure? This cannot be undone.")
    ) {
      return;
    }
    const res = await fetch(`/api/app/finance/pcaf/${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not delete exposure.");
      return;
    }
    if (selectedId === id) setSelectedId(null);
    load();
  }

  return (
    <PageFrame
      eyebrow="Finance"
      title="Financed emissions (PCAF)"
      help="Attribution = outstanding amount ÷ EVIC × borrower emissions, with a 1–5 PCAF data-quality score per exposure. Missing EVIC or borrower emissions stay quality-missing — never a fabricated zero."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={pending}
          >
            Refresh
          </Button>
          {canWrite ? (
            <Button type="button" size="sm" onClick={openCreate} disabled={pending}>
              <Plus className="size-4" aria-hidden />
              New exposure
            </Button>
          ) : null}
        </div>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      <StatusLine tone="neutral">{PCAF_DISCLAIMER}</StatusLine>
      {!canWrite ? (
        <StatusLine tone="neutral">
          View only — ask a contributor or admin to add exposures.
        </StatusLine>
      ) : null}

      {!payload && !error ? <PageSkeleton /> : null}

      {payload ? (
        <div className="space-y-6">
          {summary ? (
            <div className="grid gap-4 border-b border-rule pb-6 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Exposures
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{summary.exposureCount}</Mono>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Total outstanding
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{formatNum(summary.totalOutstanding, 0)}</Mono>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Financed emissions (tCO₂e)
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{formatNum(summary.totalFinancedEmissionsTco2e)}</Mono>
                </p>
                <p className={cn("mt-1 text-xs", qualityTone(summary.quality))}>
                  {summary.quality === "measured"
                    ? "Fully attributed"
                    : summary.quality === "partial"
                      ? `Partial · ${summary.missingCount} missing input`
                      : "Missing EVIC / emissions"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Weighted data quality
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>
                    {summary.weightedDataQualityScore === null
                      ? "—"
                      : summary.weightedDataQualityScore.toFixed(1)}
                  </Mono>
                </p>
                <p className="mt-1 text-xs text-ink-muted">1 best · 5 weakest</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Measured / partial / missing
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono className="text-signal">{summary.measuredCount}</Mono>
                  {" / "}
                  <Mono className="text-amber">{summary.partialCount}</Mono>
                  {" / "}
                  <Mono className="text-rust">{summary.missingCount}</Mono>
                </p>
              </div>
            </div>
          ) : null}

          {payload.exposures.length === 0 ? (
            <EmptyState
              title="No financed-emissions exposures yet"
              body="Add a loan or investment exposure to compute PCAF attribution. Leave EVIC or borrower emissions blank until known — the summary never invents a value."
            />
          ) : (
            <div className="overflow-x-auto border-t border-rule">
              <table className="w-full min-w-[960px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[11px] text-ink-muted">
                    <th className="py-2 pr-3 font-normal">Counterparty</th>
                    <th className="py-2 pr-3 font-normal">Asset class</th>
                    <th className="py-2 pr-3 font-normal text-right">Outstanding</th>
                    <th className="py-2 pr-3 font-normal text-right">EVIC</th>
                    <th className="py-2 pr-3 font-normal text-right">Attribution %</th>
                    <th className="py-2 pr-3 font-normal text-right">Financed tCO₂e</th>
                    <th className="py-2 pr-3 font-normal text-right">PCAF score</th>
                    <th className="py-2 font-normal"> </th>
                  </tr>
                </thead>
                <tbody>
                  {payload.exposures.map((e) => (
                    <tr
                      key={e.id}
                      className={cn(
                        "border-b border-rule cursor-pointer",
                        selectedId === e.id ? "bg-surface-2" : "hover:bg-surface-2",
                      )}
                      onClick={() => setSelectedId(e.id)}
                    >
                      <td className="py-2.5 pr-3 text-ink">{e.counterparty}</td>
                      <td className="py-2.5 pr-3 text-ink-muted">
                        {ASSET_CLASS_LABEL[e.assetClass]}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Mono>
                          {formatNum(e.outstandingAmount, 0)} {e.currency}
                        </Mono>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Mono>{e.evic === null ? "—" : formatNum(e.evic, 0)}</Mono>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Mono className={qualityTone(e.attribution.attributionQuality)}>
                          {e.attribution.attributionFactor === null
                            ? "—"
                            : `${formatNum(e.attribution.attributionFactor * 100)}%`}
                        </Mono>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Mono
                          className={qualityTone(e.attribution.financedEmissionsQuality)}
                        >
                          {formatNum(e.attribution.financedEmissionsTco2e)}
                        </Mono>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Mono>{e.attribution.dataQualityScore}</Mono>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite ? (
                            <button
                              type="button"
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-surface-1 hover:text-ink"
                              aria-label={`Edit ${e.counterparty}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openEdit(e);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-surface-1 hover:text-rust"
                              aria-label={`Delete ${e.counterparty}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void deleteExposure(e.id);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected ? (
            <div className="border border-rule rounded-[6px] bg-surface-1 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Detail
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-ink">
                {selected.counterparty}
              </h2>
              <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Data source</dt>
                  <dd className="text-right text-ink">
                    {PCAF_DATA_SOURCE_LABEL[selected.dataSource]}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Borrower Scope 1</dt>
                  <dd>
                    <Mono>{formatNum(selected.borrowerScope1Tco2e)} tCO₂e</Mono>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Borrower Scope 2</dt>
                  <dd>
                    <Mono>{formatNum(selected.borrowerScope2Tco2e)} tCO₂e</Mono>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Borrower Scope 3 (optional)</dt>
                  <dd>
                    <Mono>{formatNum(selected.borrowerScope3Tco2e)} tCO₂e</Mono>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Missing inputs</dt>
                  <dd className="text-right text-ink">
                    {selected.attribution.missingInputs.length > 0
                      ? selected.attribution.missingInputs.join(", ")
                      : "None"}
                  </dd>
                </div>
              </dl>
              {selected.notes ? (
                <p className="mt-3 border-t border-rule pt-3 text-[13px] text-ink-muted">
                  {selected.notes}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-ink-muted">{props.orgName}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pcaf-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-rule bg-surface-1 p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="pcaf-form-title"
                className="font-[family-name:var(--font-display)] text-xl text-ink"
              >
                {editingId ? "Edit exposure" : "New exposure"}
              </h2>
              <button
                type="button"
                className="rounded-[4px] p-1 text-ink-muted hover:text-ink"
                aria-label="Close"
                onClick={() => setFormOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}

            <div className="mt-3 grid gap-3">
              <AppField
                label="Counterparty"
                value={form.counterparty}
                onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))}
                required
              />
              <AppSelectNative
                label="Asset class"
                value={form.assetClass}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assetClass: e.target.value as PcafAssetClass }))
                }
              >
                {PCAF_ASSET_CLASSES.map((ac) => (
                  <option key={ac} value={ac}>
                    {ASSET_CLASS_LABEL[ac]}
                  </option>
                ))}
              </AppSelectNative>
              <div className="grid gap-3 sm:grid-cols-2">
                <AppField
                  label="Outstanding amount"
                  type="number"
                  min={0}
                  step="any"
                  className="font-[family-name:var(--font-mono)]"
                  value={form.outstandingAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, outstandingAmount: e.target.value }))
                  }
                  required
                />
                <AppSelectNative
                  label="Currency"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  {["USD", "EUR", "GBP", "INR"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </AppSelectNative>
              </div>
              <AppField
                label="EVIC (enterprise value incl. cash)"
                type="number"
                min={0}
                step="any"
                className="font-[family-name:var(--font-mono)]"
                value={form.evic}
                onChange={(e) => setForm((f) => ({ ...f, evic: e.target.value }))}
                placeholder="Leave blank if unknown"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <AppField
                  label="Borrower Scope 1 (tCO₂e)"
                  type="number"
                  min={0}
                  step="any"
                  className="font-[family-name:var(--font-mono)]"
                  value={form.borrowerScope1Tco2e}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, borrowerScope1Tco2e: e.target.value }))
                  }
                  placeholder="Unknown"
                />
                <AppField
                  label="Borrower Scope 2 (tCO₂e)"
                  type="number"
                  min={0}
                  step="any"
                  className="font-[family-name:var(--font-mono)]"
                  value={form.borrowerScope2Tco2e}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, borrowerScope2Tco2e: e.target.value }))
                  }
                  placeholder="Unknown"
                />
                <AppField
                  label="Borrower Scope 3 (optional)"
                  type="number"
                  min={0}
                  step="any"
                  className="font-[family-name:var(--font-mono)]"
                  value={form.borrowerScope3Tco2e}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, borrowerScope3Tco2e: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <AppSelectNative
                label="Data source (PCAF quality)"
                value={form.dataSource}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dataSource: e.target.value as PcafDataSource }))
                }
              >
                {DATA_SOURCE_OPTIONS.map((ds) => (
                  <option key={ds} value={ds}>
                    {PCAF_DATA_SOURCE_LABEL[ds]}
                  </option>
                ))}
              </AppSelectNative>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                <span className="label-caps">Notes</span>
                <textarea
                  className="min-h-[70px] w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveExposure()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
