"use client";

import { useCallback, useEffect, useState, useTransition, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WizardStep = "map" | "upload" | "preview" | "done";

type GlRule = { prefix: string; category: string };

type FactorRow = {
  id: string;
  factorName: string;
  category: string;
  value: number;
  unit: string;
  source: string;
  region: string;
  confidence: string;
  uncertainty: number;
};

type PreviewLine = {
  rowNumber?: number;
  category: string;
  totalSpend: number;
  currency: string;
  region: string | null;
  calculatedEmissions: number;
  emissionsFactor: number;
  confidence: string;
  uncertainty: number;
  factorSource: string;
  factorRegion: string;
  regionalAdjusted: boolean;
  quality: string;
};

const SAMPLE_CSV = `category,total_spend,currency,region,gl_code,period_start,period_end
fuel_energy,12000,USD,US,6100,2025-01-01,2025-03-31
transportation,4500,USD,US,6200,2025-01-01,2025-03-31
services,8000,EUR,EU,6300,2025-01-01,2025-03-31
raw_materials,25000,USD,Global,,2025-01-01,2025-03-31`;

const STEPS: WizardStep[] = ["map", "upload", "preview", "done"];

export function SpendWizardClient({ canCommit }: { canCommit: boolean }) {
  const [step, setStep] = useState<WizardStep>("map");
  const [csvData, setCsvData] = useState("");
  const [factors, setFactors] = useState<FactorRow[]>([]);
  const [glMap, setGlMap] = useState<GlRule[]>([]);
  const [preview, setPreview] = useState<PreviewLine[]>([]);
  const [commitSummary, setCommitSummary] = useState<{
    count: number;
    totalEmissions: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeDatapoints, setWriteDatapoints] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [pending, startTransition] = useTransition();

  const loadFactors = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/emissions/spend-factors");
        const data = (await res.json()) as {
          factors?: FactorRow[];
          glPrefixMap?: GlRule[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to load spend factors");
          return;
        }
        setFactors(data.factors ?? []);
        setGlMap(data.glPrefixMap ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load factors");
      }
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadFactors();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadFactors]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      setCsvData(text);
      setError(null);
    });
  }

  function runPreview() {
    if (!csvData.trim()) {
      setError("Paste or upload a CSV before preview.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/emissions/spend-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvData, dryRun: true }),
        });
        const data = (await res.json()) as {
          preview?: PreviewLine[];
          errors?: Array<{ rowNumber: number; error: string }>;
          error?: string;
        };
        if (!res.ok) {
          const detail =
            data.errors?.map((e) => `Row ${e.rowNumber}: ${e.error}`).join("; ") ??
            data.error ??
            "Preview failed";
          setError(detail);
          return;
        }
        setPreview(data.preview ?? []);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
      }
    });
  }

  function runCommit() {
    if (!canCommit) {
      setError("Admin access required to commit spend emissions.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/emissions/spend-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csvData,
            dryRun: false,
            writeDatapoints: writeDatapoints && Boolean(periodId),
            periodId: periodId || undefined,
          }),
        });
        const data = (await res.json()) as {
          count?: number;
          aggregate?: { totalEmissions: number };
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Commit failed");
          return;
        }
        setCommitSummary({
          count: data.count ?? 0,
          totalEmissions: data.aggregate?.totalEmissions ?? 0,
        });
        setStep("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Commit failed");
      }
    });
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spend-emissions-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-10">
      <nav
        aria-label="Wizard steps"
        className="flex flex-wrap gap-4 border-b border-rule pb-4"
      >
        {STEPS.map((s, idx) => (
          <span
            key={s}
            className={cn(
              "text-xs uppercase tracking-wide",
              idx <= stepIndex ? "text-ink" : "text-ink-muted",
            )}
          >
            <span className="font-mono">{idx + 1}</span> {s}
          </span>
        ))}
      </nav>

      {error ? (
        <div
          className="border border-rust bg-surface-2 px-4 py-3 text-sm text-rust"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {step === "map" ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-xl text-ink">Factor registry & GL map</h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">
              Active spend factors (kg CO2e per currency unit) for this organisation.
              Missing factors must be uploaded via Admin → Factors before calculation. GL
              prefixes below seed the CSV mapping wizard when category is omitted.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-rule-strong text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium">Region</th>
                  <th className="py-2 pr-3 font-medium">Factor</th>
                  <th className="py-2 pr-3 font-medium">±%</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {factors.length === 0 ? (
                  <tr className="border-b border-rule">
                    <td colSpan={6} className="py-6 text-ink-muted">
                      No active spend factors. Upload USEEIO/EXIOBASE rows with unit
                      kg_co2e_usd (or eur/gbp/inr) via /api/app/admin/factors/upload.
                    </td>
                  </tr>
                ) : (
                  factors.map((f) => (
                    <tr key={f.id} className="border-b border-rule">
                      <td className="py-3 pr-3 text-ink">{f.factorName}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-ink">
                        {f.category}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                        {f.region}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-ink">
                        {f.value} {f.unit.replace("kg_co2e_", "")}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                        {f.uncertainty}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                        {f.source}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink">Default GL prefix → category</h3>
            <ul className="mt-2 grid gap-1 font-mono text-xs text-ink-muted sm:grid-cols-2">
              {glMap.map((r) => (
                <li key={`${r.prefix}-${r.category}`}>
                  {r.prefix}* → {r.category}
                </li>
              ))}
            </ul>
          </div>

          <Button type="button" onClick={() => setStep("upload")} disabled={pending}>
            Continue to CSV
          </Button>
        </section>
      ) : null}

      {step === "upload" ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-xl text-ink">Upload spend CSV</h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">
              Required: total_spend, currency, and category or gl_code. Optional: region,
              period_start, period_end, industry_code.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 border border-rule px-3 py-2 text-sm text-ink hover:border-rule-strong">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFile}
              />
              Choose file
            </label>
            <Button type="button" variant="secondary" onClick={downloadSample}>
              Download template
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("map")}>
              Back
            </Button>
          </div>

          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-rule-strong"
            placeholder={SAMPLE_CSV}
            aria-label="Spend CSV"
          />

          <Button type="button" onClick={runPreview} disabled={pending}>
            {pending ? "Calculating…" : "Preview emissions"}
          </Button>
        </section>
      ) : null}

      {step === "preview" ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-xl text-ink">Preview</h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">
              Review calculated kg CO2e, uncertainty, and regional adjustments before
              committing to the organisation ledger. Quality is always estimated
              (spend-based).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-rule-strong text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Row</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium">Spend</th>
                  <th className="py-2 pr-3 font-medium">kg CO2e</th>
                  <th className="py-2 pr-3 font-medium">Factor</th>
                  <th className="py-2 pr-3 font-medium">±%</th>
                  <th className="py-2 pr-3 font-medium">Region</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((line, idx) => (
                  <tr
                    key={`${line.rowNumber ?? idx}-${line.category}`}
                    className="border-b border-rule"
                  >
                    <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                      {line.rowNumber ?? idx + 1}
                    </td>
                    <td className="py-3 pr-3 text-ink">{line.category}</td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink">
                      {line.totalSpend} {line.currency}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink">
                      {line.calculatedEmissions}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                      {line.emissionsFactor} ({line.factorSource})
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                      {line.uncertainty}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                      {line.factorRegion}
                      {line.regionalAdjusted ? " adj" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canCommit ? (
            <div className="space-y-3 border-t border-rule pt-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={writeDatapoints}
                  onChange={(e) => setWriteDatapoints(e.target.checked)}
                  className="rounded-sm border-rule"
                />
                Also write org datapoints (tCO2e, quality estimated)
              </label>
              {writeDatapoints ? (
                <input
                  type="text"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  placeholder="Reporting period id"
                  className="w-full max-w-md border border-rule bg-surface-1 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-rule-strong"
                  aria-label="Reporting period id"
                />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              View-only: ask an admin to commit these rows.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("upload")}>
              Back
            </Button>
            {canCommit ? (
              <Button type="button" onClick={runCommit} disabled={pending}>
                {pending ? "Committing…" : "Commit to org emissions"}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === "done" && commitSummary ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl text-ink">Committed</h2>
          <div className="title-rule mt-2" />
          <p className="text-sm text-ink-muted">
            Wrote <span className="font-mono text-ink">{commitSummary.count}</span> spend
            records. Total{" "}
            <span className="font-mono text-ink">{commitSummary.totalEmissions}</span> kg
            CO2e (quality: estimated, provenance: spend_estimate).
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStep("map");
              setPreview([]);
              setCommitSummary(null);
              setCsvData("");
              loadFactors();
            }}
          >
            Start another batch
          </Button>
        </section>
      ) : null}
    </div>
  );
}
