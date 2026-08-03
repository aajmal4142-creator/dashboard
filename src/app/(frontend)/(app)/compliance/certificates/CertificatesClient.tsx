"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Download, FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CertificateType = "REC" | "GO" | "EAC" | "PPA" | "green_tariff";
type CertificateStatus = "active" | "retired" | "expired";

type Certificate = {
  id: string;
  label: string | null;
  certificateType: CertificateType;
  volumeKwh: number;
  vintageYear: number;
  region: string;
  country: string | null;
  status: CertificateStatus;
  periodId: string;
  periodLabel: string | null;
  supplier: string | null;
  notes: string | null;
};

type PeriodOption = { id: string; label: string; status: string };

type Volumes = {
  lineCount: number;
  totalVolumeKwh: number;
  activeVolumeKwh: number;
  retiredVolumeKwh: number;
  expiredVolumeKwh: number;
  electricityKwh: number | null;
  uncoveredKwh: number | null;
  coverageRatio: number | null;
  quality: "measured" | "missing";
  message: string | null;
};

type MarketBasedHook = {
  coveredKwh: number;
  uncoveredKwh: number | null;
  coverageRatio: number | null;
  instrumentCount: number;
  residualMixAvailable: boolean;
  dualReady: boolean;
  instrumentFactorQuality: "measured" | "estimated";
  message: string | null;
};

type SummaryPayload = {
  periodId: string | null;
  periodLabel: string | null;
  certificates: Certificate[];
  volumes: Volumes;
  marketBasedHook: MarketBasedHook;
  periods: PeriodOption[];
};

type FormState = {
  label: string;
  certificateType: CertificateType;
  volumeKwh: string;
  vintageYear: string;
  region: string;
  country: string;
  status: CertificateStatus;
  periodId: string;
  supplier: string;
  notes: string;
};

type ImportPreview = {
  mode: string;
  valid: boolean;
  rows: Array<Record<string, unknown>>;
  errors: Array<{ rowNumber: number; field: string; error: string }>;
  wouldImport?: number;
  imported?: number;
};

const TYPE_LABELS: Record<CertificateType, string> = {
  REC: "REC",
  GO: "GO",
  EAC: "EAC",
  PPA: "PPA",
  green_tariff: "Green tariff",
};

function emptyForm(periodId: string, year: number): FormState {
  return {
    label: "",
    certificateType: "REC",
    volumeKwh: "",
    vintageYear: String(year),
    region: "",
    country: "",
    status: "active",
    periodId,
    supplier: "",
    notes: "",
  };
}

function formatNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatPct(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function statusClass(status: CertificateStatus): string {
  if (status === "active") return "text-[color:var(--signal)]";
  if (status === "retired") return "text-[color:var(--ink-muted)]";
  return "text-[color:var(--amber)]";
}

export function CertificatesClient({ orgName }: { orgName: string }) {
  const [periodId, setPeriodId] = useState("");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm("", new Date().getUTCFullYear()),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const qs = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
        const res = await fetch(`/api/app/compliance/certificates/summary${qs}`);
        const json = (await res.json()) as SummaryPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not load certificate ledger");
          return;
        }
        setSummary(json);
        setPeriods(json.periods ?? []);
        if (!periodId && json.periods?.length === 1) {
          setPeriodId(json.periods[0]!.id);
        }
      } catch {
        setError("Network error loading certificates. Retry.");
      }
    });
  }, [periodId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(periodId || periods[0]?.id || "", new Date().getUTCFullYear()));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(c: Certificate) {
    setEditingId(c.id);
    setForm({
      label: c.label ?? "",
      certificateType: c.certificateType,
      volumeKwh: String(c.volumeKwh),
      vintageYear: String(c.vintageYear),
      region: c.region,
      country: c.country ?? "",
      status: c.status,
      periodId: c.periodId,
      supplier: c.supplier ?? "",
      notes: c.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveCertificate() {
    setFormError(null);
    const volumeKwh = Number(form.volumeKwh);
    const vintageYear = Number(form.vintageYear);
    if (!form.periodId) {
      setFormError("Select a reporting period.");
      return;
    }
    if (!Number.isFinite(volumeKwh) || volumeKwh < 0) {
      setFormError("Volume (kWh) must be a non-negative number.");
      return;
    }
    if (!Number.isInteger(vintageYear) || vintageYear < 1990 || vintageYear > 2100) {
      setFormError("Vintage year must be an integer between 1990 and 2100.");
      return;
    }
    if (!form.region.trim()) {
      setFormError("Region is required.");
      return;
    }
    if (form.country.trim() && !/^[A-Za-z]{2}$/.test(form.country.trim())) {
      setFormError("Country must be a 2-letter ISO code when provided.");
      return;
    }

    const payload = {
      label: form.label.trim() || null,
      certificateType: form.certificateType,
      volumeKwh,
      vintageYear,
      region: form.region.trim(),
      country: form.country.trim() ? form.country.trim().toUpperCase() : null,
      status: form.status,
      periodId: form.periodId,
      supplier: form.supplier.trim() || null,
      notes: form.notes.trim() || null,
    };

    const res = await fetch(
      editingId
        ? `/api/app/compliance/certificates/${editingId}`
        : "/api/app/compliance/certificates",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setFormError(json.error ?? "Could not save certificate");
      return;
    }
    setFormOpen(false);
    load();
  }

  async function deleteCertificate(id: string) {
    const res = await fetch(`/api/app/compliance/certificates/${id}`, {
      method: "DELETE",
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not delete certificate");
      return;
    }
    load();
  }

  async function dryRunImport() {
    setImportError(null);
    setImportPreview(null);
    const res = await fetch("/api/app/compliance/certificates/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText, mode: "dry-run" }),
    });
    const json = (await res.json()) as ImportPreview & { error?: string };
    if (!res.ok) {
      setImportError(json.error ?? "Dry-run failed");
      return;
    }
    setImportPreview(json);
  }

  async function applyImport() {
    setImportError(null);
    const res = await fetch("/api/app/compliance/certificates/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText, mode: "apply" }),
    });
    const json = (await res.json()) as ImportPreview & { error?: string };
    if (!res.ok) {
      setImportError(json.error ?? "Import failed");
      return;
    }
    if (!json.valid) {
      setImportPreview(json);
      setImportError("Fix validation errors before applying.");
      return;
    }
    setImportPreview(json);
    setCsvText("");
    load();
  }

  async function downloadTemplate() {
    const res = await fetch("/api/app/compliance/certificates/import");
    const json = (await res.json()) as { template?: string; error?: string };
    if (!res.ok || !json.template) {
      setImportError(json.error ?? "Could not load template");
      return;
    }
    const blob = new Blob([json.template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "energy-certificates-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const volumes = summary?.volumes;
  const marketHook = summary?.marketBasedHook;
  const certificates = summary?.certificates ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--rule)] pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
            Organisation
          </p>
          <p className="mt-1 text-sm text-[color:var(--ink)]">{orgName}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-[color:var(--ink-muted)]">
            Period
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="mt-1 block min-w-[12rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
            >
              <option value="">All periods</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportOpen((v) => !v)}
          >
            <FileSpreadsheet className="mr-1.5 size-3.5" />
            CSV import
          </Button>
          <Button type="button" onClick={openCreate} disabled={periods.length === 0}>
            <Plus className="mr-1.5 size-3.5" />
            Add certificate
          </Button>
        </div>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {pending && !summary ? (
        <StatusLine tone="neutral">Loading certificate ledger…</StatusLine>
      ) : null}
      {periods.length === 0 && !pending ? (
        <StatusLine tone="error">
          Create a reporting period before recording certificates.
        </StatusLine>
      ) : null}

      {volumes ? (
        <section className="grid gap-4 border-b border-[color:var(--rule)] pb-6 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Active volume
            </p>
            <p className="mt-1 text-2xl text-[color:var(--ink)]">
              <Mono>{formatNum(volumes.activeVolumeKwh)}</Mono>
              <span className="ml-1 text-sm text-[color:var(--ink-muted)]">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Electricity
            </p>
            <p className="mt-1 text-2xl text-[color:var(--ink)]">
              <Mono>{formatNum(volumes.electricityKwh)}</Mono>
              <span className="ml-1 text-sm text-[color:var(--ink-muted)]">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Coverage
            </p>
            <p className="mt-1 text-2xl text-[color:var(--ink)]">
              <Mono>{formatPct(volumes.coverageRatio)}</Mono>
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              Uncovered <Mono>{formatNum(volumes.uncoveredKwh)}</Mono> kWh
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Market-based
            </p>
            <p className="mt-1 text-sm text-[color:var(--ink)]">
              {marketHook?.dualReady ? (
                <span className="text-[color:var(--signal)]">Dual ready</span>
              ) : (
                <span className="text-[color:var(--amber)]">Incomplete</span>
              )}
              {" · "}
              <Mono>{formatNum(marketHook?.instrumentCount, 0)}</Mono> instruments
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              residual_mix {marketHook?.residualMixAvailable ? "available" : "missing"}
              {marketHook?.instrumentFactorQuality === "estimated"
                ? " · factors estimated"
                : null}
            </p>
            {marketHook?.message ? (
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {marketHook.message}
              </p>
            ) : volumes.message ? (
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {volumes.message}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {importOpen ? (
        <section className="space-y-3 rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              CSV import
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-1.5 size-3.5" />
              Template
            </Button>
          </div>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Dry-run validates rows and resolves period by id or label before writing. No
            paid registry lookups.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder="Paste CSV…"
            className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--ink)]"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={dryRunImport}
              disabled={!csvText.trim()}
            >
              Dry-run
            </Button>
            <Button
              type="button"
              onClick={applyImport}
              disabled={!csvText.trim() || !importPreview?.valid}
            >
              Apply import
            </Button>
          </div>
          {importError ? <StatusLine tone="error">{importError}</StatusLine> : null}
          {importPreview ? (
            <div className="space-y-2 text-sm">
              <StatusLine tone={importPreview.valid ? "ok" : "error"}>
                {importPreview.valid
                  ? `Valid — ${importPreview.wouldImport ?? importPreview.imported ?? 0} row(s)`
                  : `${importPreview.errors.length} validation error(s)`}
              </StatusLine>
              {importPreview.errors.slice(0, 8).map((err) => (
                <p
                  key={`${err.rowNumber}-${err.field}`}
                  className="text-[color:var(--rust)]"
                >
                  Row <Mono>{err.rowNumber}</Mono> · {err.field}: {err.error}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          Ledger
          {summary?.periodLabel ? ` · ${summary.periodLabel}` : ""}
        </h2>

        {!pending && certificates.length === 0 ? (
          <EmptyState
            title="No certificates recorded"
            body="Add a REC, GO, EAC, PPA, or green tariff line, or import a CSV. Active volume feeds the coverage summary above."
          />
        ) : (
          <div className="overflow-x-auto border-t border-[color:var(--rule)]">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-normal">Type</th>
                  <th className="py-2 pr-3 font-normal">Label</th>
                  <th className="py-2 pr-3 font-normal">Volume</th>
                  <th className="py-2 pr-3 font-normal">Vintage</th>
                  <th className="py-2 pr-3 font-normal">Region</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal">Period</th>
                  <th className="py-2 font-normal"> </th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((c) => (
                  <tr key={c.id} className="border-b border-[color:var(--rule)]">
                    <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                      {TYPE_LABELS[c.certificateType]}
                    </td>
                    <td className="py-2.5 pr-3 text-[color:var(--ink-muted)]">
                      {c.label ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                      <Mono>{formatNum(c.volumeKwh)}</Mono>
                      <span className="ml-1 text-[color:var(--ink-muted)]">kWh</span>
                    </td>
                    <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                      <Mono>{c.vintageYear}</Mono>
                    </td>
                    <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                      {c.region}
                      {c.country ? (
                        <span className="text-[color:var(--ink-muted)]">
                          {" "}
                          · {c.country}
                        </span>
                      ) : null}
                    </td>
                    <td className={cn("py-2.5 pr-3 capitalize", statusClass(c.status))}>
                      {c.status}
                    </td>
                    <td className="py-2.5 pr-3 text-[color:var(--ink-muted)]">
                      {c.periodLabel ?? c.periodId}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(c)}
                        aria-label="Edit certificate"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCertificate(c.id)}
                        aria-label="Delete certificate"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <section className="space-y-4 rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
            {editingId ? "Edit certificate" : "Add certificate"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-[color:var(--ink-muted)]">
              Type
              <select
                value={form.certificateType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    certificateType: e.target.value as CertificateType,
                  }))
                }
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              >
                {(Object.keys(TYPE_LABELS) as CertificateType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Volume (kWh)
              <input
                value={form.volumeKwh}
                onChange={(e) => setForm((f) => ({ ...f, volumeKwh: e.target.value }))}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Vintage year
              <input
                type="number"
                min={1990}
                max={2100}
                value={form.vintageYear}
                onChange={(e) => setForm((f) => ({ ...f, vintageYear: e.target.value }))}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Region
              <input
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Country (ISO)
              <input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                maxLength={2}
                placeholder="IN"
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm uppercase text-[color:var(--ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as CertificateStatus,
                  }))
                }
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              >
                <option value="active">Active</option>
                <option value="retired">Retired</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Period
              <select
                value={form.periodId}
                onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              >
                <option value="">Select…</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Label
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--ink-muted)]">
              Supplier
              <input
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--ink-muted)] sm:col-span-2 lg:col-span-3">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              />
            </label>
          </div>
          {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveCertificate}>
              {editingId ? "Save changes" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
