"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Download, FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { CBAM_DEFAULT_VALUE_TABLE, findCbamDefaultForCn } from "@/lib/cbam/defaults";
import { cn } from "@/lib/utils";

type Quality = "measured" | "estimated" | "missing";
type Quarter = "1" | "2" | "3" | "4";
type QuantityUnit = "t" | "kg" | "mwh";
type DeclarationStatus = "draft" | "ready" | "submitted";

type LineResult = {
  quantityNormalised: number | null;
  quantityUnit: QuantityUnit;
  directTotal: number | null;
  indirectTotal: number | null;
  embeddedTotal: number | null;
  quality: Quality;
  message: string | null;
};

type Good = {
  id: string;
  cnCode: string;
  description: string | null;
  quantity: number | null;
  quantityUnit: QuantityUnit;
  directEmissions: number | null;
  indirectEmissions: number | null;
  usesDefaultValues: boolean;
  installationCountry: string;
  reportingYear: number;
  reportingQuarter: Quarter;
  notes: string | null;
  line: LineResult;
};

type Declaration = {
  id: string;
  label: string;
  reportingYear: number;
  reportingQuarter: Quarter;
  status: DeclarationStatus;
  certificatePriceEur: number | null;
  notes: string | null;
  declarantName: string | null;
  declarantEori: string | null;
  declarantCountry: string | null;
  declarantEmail: string | null;
};

type Liability = {
  embeddedTotal: number | null;
  certificatePriceEur: number | null;
  liabilityEur: number | null;
  quality: Quality;
  message: string | null;
  lineCount: number;
  measuredLines: number;
  estimatedLines: number;
  missingLines: number;
  defaultValueLines: number;
};

type SummaryPayload = {
  reportingYear: number;
  reportingQuarter: Quarter;
  declaration: Declaration | null;
  goods: Good[];
  liability: Liability;
};

type FormState = {
  cnCode: string;
  description: string;
  quantity: string;
  quantityUnit: QuantityUnit;
  directEmissions: string;
  indirectEmissions: string;
  usesDefaultValues: boolean;
  installationCountry: string;
  reportingYear: string;
  reportingQuarter: Quarter;
  notes: string;
};

type ImportPreview = {
  mode: string;
  valid: boolean;
  rows: Array<Good & { rowNumber?: number }>;
  errors: Array<{ rowNumber: number; field: string; error: string }>;
  wouldImport?: number;
  imported?: number;
};

const emptyForm = (year: number, quarter: Quarter): FormState => ({
  cnCode: "",
  description: "",
  quantity: "",
  quantityUnit: "t",
  directEmissions: "",
  indirectEmissions: "",
  usesDefaultValues: false,
  installationCountry: "",
  reportingYear: String(year),
  reportingQuarter: quarter,
  notes: "",
});

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function qualityClass(q: Quality): string {
  if (q === "measured") return "text-[color:var(--signal)]";
  if (q === "estimated") return "text-[color:var(--amber)]";
  return "text-[color:var(--rust)]";
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

export function CbamClient({
  orgName,
  defaultYear,
  defaultQuarter,
}: {
  orgName: string;
  defaultYear: number;
  defaultQuarter: Quarter;
}) {
  const [year, setYear] = useState(defaultYear);
  const [quarter, setQuarter] = useState<Quarter>(defaultQuarter);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultYear, defaultQuarter),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [declStatus, setDeclStatus] = useState<DeclarationStatus>("draft");
  const [declError, setDeclError] = useState<string | null>(null);
  const [declarantName, setDeclarantName] = useState("");
  const [declarantEori, setDeclarantEori] = useState("");
  const [declarantCountry, setDeclarantCountry] = useState("");
  const [declarantEmail, setDeclarantEmail] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/app/compliance/cbam/summary?year=${year}&quarter=${quarter}`,
        );
        const json = (await res.json()) as SummaryPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not load CBAM summary");
          return;
        }
        setSummary(json);
        setPriceInput(
          json.declaration?.certificatePriceEur != null
            ? String(json.declaration.certificatePriceEur)
            : "",
        );
        setDeclStatus(json.declaration?.status ?? "draft");
        setDeclarantName(json.declaration?.declarantName ?? "");
        setDeclarantEori(json.declaration?.declarantEori ?? "");
        setDeclarantCountry(json.declaration?.declarantCountry ?? "");
        setDeclarantEmail(json.declaration?.declarantEmail ?? "");
      } catch {
        setError("Network error loading CBAM data. Retry.");
      }
    });
  }, [year, quarter]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(year, quarter));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(g: Good) {
    setEditingId(g.id);
    setForm({
      cnCode: g.cnCode,
      description: g.description ?? "",
      quantity: g.quantity != null ? String(g.quantity) : "",
      quantityUnit: g.quantityUnit,
      directEmissions: g.directEmissions != null ? String(g.directEmissions) : "",
      indirectEmissions: g.indirectEmissions != null ? String(g.indirectEmissions) : "",
      usesDefaultValues: g.usesDefaultValues,
      installationCountry: g.installationCountry,
      reportingYear: String(g.reportingYear),
      reportingQuarter: g.reportingQuarter,
      notes: g.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveGood() {
    setFormError(null);
    const quantity = Number(form.quantity);
    const reportingYear = Number(form.reportingYear);
    if (!form.cnCode.trim()) {
      setFormError("Enter a CN code.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      setFormError("Quantity must be a non-negative number.");
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(form.installationCountry.trim())) {
      setFormError("Installation country must be a 2-letter ISO code.");
      return;
    }
    if (!Number.isInteger(reportingYear) || reportingYear < 2023) {
      setFormError("Reporting year must be an integer ≥ 2023.");
      return;
    }

    const payload = {
      cnCode: form.cnCode.trim(),
      description: form.description.trim() || null,
      quantity,
      quantityUnit: form.quantityUnit,
      directEmissions: form.directEmissions.trim() ? Number(form.directEmissions) : null,
      indirectEmissions: form.indirectEmissions.trim()
        ? Number(form.indirectEmissions)
        : null,
      usesDefaultValues: form.usesDefaultValues,
      installationCountry: form.installationCountry.trim().toUpperCase(),
      reportingYear,
      reportingQuarter: form.reportingQuarter,
      notes: form.notes.trim() || null,
    };

    const res = await fetch(
      editingId ? `/api/app/compliance/cbam/${editingId}` : "/api/app/compliance/cbam",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setFormError(json.error ?? "Could not save goods line");
      return;
    }
    setFormOpen(false);
    load();
  }

  async function deleteGood(id: string) {
    const res = await fetch(`/api/app/compliance/cbam/${id}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not delete goods line");
      return;
    }
    load();
  }

  async function saveDeclaration() {
    setDeclError(null);
    const price = priceInput.trim() ? Number(priceInput) : null;
    if (priceInput.trim() && (!Number.isFinite(price) || (price as number) < 0)) {
      setDeclError("Certificate price must be a non-negative number.");
      return;
    }
    const res = await fetch("/api/app/compliance/cbam/declarations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportingYear: year,
        reportingQuarter: quarter,
        status: declStatus,
        certificatePriceEur: price,
        declarantName: declarantName.trim() || null,
        declarantEori: declarantEori.trim() || null,
        declarantCountry: declarantCountry.trim() || null,
        declarantEmail: declarantEmail.trim() || null,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setDeclError(json.error ?? "Could not save declaration draft");
      return;
    }
    load();
  }

  async function downloadFilingPack(format: "json" | "csv") {
    const res = await fetch(
      `/api/app/compliance/cbam/filing-pack?year=${year}&quarter=${quarter}&format=${format}`,
    );
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Could not build filing pack");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cbam-filing-${year}-Q${quarter}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyIndicativeDefault() {
    const row = findCbamDefaultForCn(form.cnCode);
    if (!row) {
      setFormError(
        "No indicative default for this CN prefix. Enter measured values or pick a matching CN.",
      );
      return;
    }
    setForm((f) => ({
      ...f,
      directEmissions: String(row.defaultDirect),
      indirectEmissions: String(row.defaultIndirect),
      quantityUnit: row.quantityUnit,
      usesDefaultValues: true,
    }));
    setFormError(null);
  }

  async function dryRunImport() {
    setImportError(null);
    setImportPreview(null);
    const res = await fetch("/api/app/compliance/cbam/import", {
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
    const res = await fetch("/api/app/compliance/cbam/import", {
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
    const res = await fetch("/api/app/compliance/cbam/import");
    const json = (await res.json()) as { template?: string; error?: string };
    if (!res.ok || !json.template) {
      setImportError(json.error ?? "Could not load template");
      return;
    }
    const blob = new Blob([json.template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cbam-goods-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const liability = summary?.liability;
  const goods = summary?.goods ?? [];

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
            Year
            <input
              type="number"
              min={2023}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 block w-24 rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--ink-muted)]">
            Quarter
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as Quarter)}
              className="mt-1 block rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
            >
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => void downloadFilingPack("csv")}
          >
            <Download className="mr-1.5 size-3.5" />
            Filing CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void downloadFilingPack("json")}
          >
            <Download className="mr-1.5 size-3.5" />
            Filing JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportOpen((v) => !v)}
          >
            <FileSpreadsheet className="mr-1.5 size-3.5" />
            CSV import
          </Button>
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1.5 size-3.5" />
            Add goods
          </Button>
        </div>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {pending && !summary ? (
        <StatusLine tone="neutral">
          Loading CBAM draft for {year} Q{quarter}…
        </StatusLine>
      ) : null}

      {liability ? (
        <section className="grid gap-4 border-b border-[color:var(--rule)] pb-6 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Lines
            </p>
            <p className="mt-1 text-2xl text-[color:var(--ink)]">
              <Mono>{formatNum(liability.lineCount, 0)}</Mono>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Embedded total
            </p>
            <p className="mt-1 text-2xl text-[color:var(--ink)]">
              <Mono>{formatNum(liability.embeddedTotal)}</Mono>
              <span className="ml-1 text-sm text-[color:var(--ink-muted)]">tCO₂e</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Liability estimate
            </p>
            <p className="mt-1 text-2xl text-[color:var(--ink)]">
              <Mono>{formatNum(liability.liabilityEur)}</Mono>
              <span className="ml-1 text-sm text-[color:var(--ink-muted)]">EUR</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Data quality
            </p>
            <p className={cn("mt-1 text-sm capitalize", qualityClass(liability.quality))}>
              {liability.quality}
            </p>
            {liability.message ? (
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {liability.message}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 border-b border-[color:var(--rule)] pb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          Quarterly draft
        </h2>
        <p className="text-sm text-[color:var(--ink-muted)]">
          Declarant → draft → ready → submitted. Set the certificate price used for the
          liability estimate. Leave blank if unknown — the estimate stays quality missing
          rather than inventing a rate.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-[color:var(--ink-muted)]">
            Declarant name
            <input
              value={declarantName}
              onChange={(e) => setDeclarantName(e.target.value)}
              className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--ink-muted)]">
            EORI
            <input
              value={declarantEori}
              onChange={(e) => setDeclarantEori(e.target.value)}
              className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--ink-muted)]">
            Country (ISO-2)
            <input
              value={declarantCountry}
              onChange={(e) => setDeclarantCountry(e.target.value)}
              maxLength={2}
              className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm uppercase text-[color:var(--ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--ink-muted)]">
            Contact email
            <input
              type="email"
              value={declarantEmail}
              onChange={(e) => setDeclarantEmail(e.target.value)}
              className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-[color:var(--ink-muted)]">
            Certificate price (€ / tCO₂e)
            <input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 65"
              className="mt-1 block w-40 rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--ink-muted)]">
            Status
            <select
              value={declStatus}
              onChange={(e) => setDeclStatus(e.target.value as DeclarationStatus)}
              className="mt-1 block rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="submitted">Submitted</option>
            </select>
          </label>
          <Button type="button" onClick={() => void saveDeclaration()}>
            Save declaration
          </Button>
        </div>
        {declError ? <StatusLine tone="error">{declError}</StatusLine> : null}
      </section>

      <section className="space-y-3 border-b border-[color:var(--rule)] pb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          Indicative default values
        </h2>
        <p className="text-sm text-[color:var(--ink-muted)]">
          Applying a default sets <Mono>usesDefaultValues</Mono> on the goods line. The
          calc engine never invents these silently — confirm against competent-authority
          tables before filing.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--rule)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                <th className="py-2 pr-3 font-medium">CN</th>
                <th className="py-2 pr-3 font-medium">Sector</th>
                <th className="py-2 pr-3 font-medium">Direct</th>
                <th className="py-2 pr-3 font-medium">Indirect</th>
                <th className="py-2 font-medium">Unit</th>
              </tr>
            </thead>
            <tbody>
              {CBAM_DEFAULT_VALUE_TABLE.map((row) => (
                <tr key={row.cnPrefix} className="border-b border-[color:var(--rule)]">
                  <td className="py-2 pr-3 font-[family-name:var(--font-mono)] tabular-nums text-[color:var(--ink)]">
                    {row.cnPrefix}
                  </td>
                  <td className="py-2 pr-3 text-[color:var(--ink)]">{row.label}</td>
                  <td className="py-2 pr-3 font-[family-name:var(--font-mono)] tabular-nums">
                    {row.defaultDirect}
                  </td>
                  <td className="py-2 pr-3 font-[family-name:var(--font-mono)] tabular-nums">
                    {row.defaultIndirect}
                  </td>
                  <td className="py-2 font-[family-name:var(--font-mono)]">
                    {row.quantityUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {importOpen ? (
        <section className="space-y-3 border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4 rounded-[6px]">
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
            Dry-run validates rows and shows embedded totals before writing. Empty
            emission cells stay missing — they are not filled with zero.
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
          Goods · {year} Q{quarter}
        </h2>

        {!pending && goods.length === 0 ? (
          <EmptyState
            title="No CBAM goods for this quarter"
            body="Add a goods line or import a CSV. Each line needs CN code, quantity, installation country, and reporting period. Embedded emissions may be left blank until known."
            action={
              <Button type="button" onClick={openCreate}>
                <Plus className="mr-1.5 size-3.5" />
                Add first goods line
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule-strong)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-medium">CN</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Country</th>
                  <th className="py-2 pr-3 font-medium">Direct</th>
                  <th className="py-2 pr-3 font-medium">Indirect</th>
                  <th className="py-2 pr-3 font-medium">Embedded</th>
                  <th className="py-2 pr-3 font-medium">Quality</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {goods.map((g) => (
                  <tr key={g.id} className="border-b border-[color:var(--rule)]">
                    <td className="py-2.5 pr-3">
                      <Mono className="text-[color:var(--ink)]">{g.cnCode}</Mono>
                      {g.description ? (
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          {g.description}
                        </p>
                      ) : null}
                      {g.usesDefaultValues ? (
                        <p className="text-xs text-[color:var(--amber)]">
                          Default values
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>
                        {formatNum(g.quantity)} {g.quantityUnit}
                      </Mono>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{g.installationCountry}</Mono>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{formatNum(g.directEmissions)}</Mono>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{formatNum(g.indirectEmissions)}</Mono>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{formatNum(g.line.embeddedTotal)}</Mono>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 capitalize",
                        qualityClass(g.line.quality),
                      )}
                    >
                      {g.line.quality}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(g)}
                          className="rounded-[4px] border border-[color:var(--rule)] p-1.5 text-[color:var(--ink-muted)] hover:border-[color:var(--rule-strong)] hover:text-[color:var(--ink)]"
                          aria-label="Edit goods line"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGood(g.id)}
                          className="rounded-[4px] border border-[color:var(--rule)] p-1.5 text-[color:var(--ink-muted)] hover:border-[color:var(--rust)] hover:text-[color:var(--rust)]"
                          aria-label="Delete goods line"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cbam-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--canvas)] p-5 shadow-sm">
            <h3
              id="cbam-form-title"
              className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
            >
              {editingId ? "Edit goods line" : "Add goods line"}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[color:var(--ink-muted)] sm:col-span-1">
                CN code
                <input
                  value={form.cnCode}
                  onChange={(e) => setForm((f) => ({ ...f, cnCode: e.target.value }))}
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Installation country
                <input
                  value={form.installationCountry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, installationCountry: e.target.value }))
                  }
                  placeholder="IN"
                  maxLength={2}
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm uppercase tabular-nums text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)] sm:col-span-2">
                Description
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Quantity
                <input
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Unit
                <select
                  value={form.quantityUnit}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      quantityUnit: e.target.value as QuantityUnit,
                    }))
                  }
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                >
                  <option value="t">Tonnes (t)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="mwh">MWh</option>
                </select>
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Direct emissions (tCO₂e / unit)
                <input
                  value={form.directEmissions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, directEmissions: e.target.value }))
                  }
                  placeholder="leave blank if unknown"
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Indirect emissions (tCO₂e / unit)
                <input
                  value={form.indirectEmissions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, indirectEmissions: e.target.value }))
                  }
                  placeholder="leave blank if unknown"
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Year
                <input
                  value={form.reportingYear}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reportingYear: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--ink-muted)]">
                Quarter
                <select
                  value={form.reportingQuarter}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      reportingQuarter: e.target.value as Quarter,
                    }))
                  }
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                >
                  <option value="1">Q1</option>
                  <option value="2">Q2</option>
                  <option value="3">Q3</option>
                  <option value="4">Q4</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[color:var(--ink)] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.usesDefaultValues}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, usesDefaultValues: e.target.checked }))
                  }
                  className="size-4 rounded-[2px] border-[color:var(--rule)]"
                />
                Uses Commission default values
              </label>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyIndicativeDefault}
                >
                  Apply indicative default for CN
                </Button>
              </div>
              <label className="text-xs text-[color:var(--ink-muted)] sm:col-span-2">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 block w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                />
              </label>
            </div>
            {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveGood}>
                {editingId ? "Save changes" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
