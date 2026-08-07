"use client";

import Link from "next/link";
import { useState } from "react";

import { PageCard, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { appFieldClass } from "@/components/ui/AppField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GstEmissionsPreview = {
  calculatedEmissions: number;
  emissionsFactor: number;
  confidence: "low" | "medium" | "high";
  uncertainty: number;
  factorSource: string;
  factorRegion: string;
};

type GstPreviewRow = {
  hsnCode: string;
  amount: number;
  description: string | null;
  mapped: boolean;
  scope3Category: number | null;
  spendLedgerCategory: string | null;
  metricKey: string | null;
  confidence: "high" | "medium" | "low" | null;
  note: string | null;
  quality: "estimated" | "unmapped";
  emissionsPreview: GstEmissionsPreview | null;
  emissionsError: string | null;
};

type PreviewResponse = {
  mode: "preview";
  count: number;
  mappedCount: number;
  pricedCount: number;
  rows: GstPreviewRow[];
  error?: string;
};

type CommitResponse = {
  mode: "commit";
  count: number;
  createdIds: string[];
  datapointIds: string[];
  skipped: Array<{ hsnCode: string; reason: string }>;
  error?: string;
};

type ImportResponse = PreviewResponse | CommitResponse;

const SAMPLE_CSV = [
  "hsn_code,amount,description",
  "27101990,50000,Diesel purchase for backup generator",
  "9965,120000,Freight — inbound raw material transport",
  "8471,300000,Laptops for engineering team",
  "9954,80000,Office fit-out — civil contractor",
].join("\n");

function confidenceTone(
  confidence: "high" | "medium" | "low" | null,
): "signal" | "amber" | "rust" {
  if (confidence === "high") return "signal";
  if (confidence === "medium") return "amber";
  return "rust";
}

export function GstHsnImportClient({ canWrite }: { canWrite: boolean }) {
  const [csvData, setCsvData] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/scope3/gst-hsn-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData, dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportResponse & {
        errors?: Array<{ rowNumber: number; field: string; error: string }>;
      };
      if (!res.ok) {
        const detail = data.errors
          ?.map((e) => `Row ${e.rowNumber}: ${e.error}`)
          .join("; ");
        setError(
          data.error
            ? [data.error, detail].filter(Boolean).join(" — ")
            : "Import failed.",
        );
        setResult(null);
        return;
      }
      setResult(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const previewRows = result?.mode === "preview" ? result.rows : null;
  const commitResult = result?.mode === "commit" ? result : null;

  return (
    <PageFrame
      eyebrow="Scope 3 · India"
      title="GST / HSN → Scope 3 spend mapping"
      help="Paste HSN/SAC codes and taxable amounts from GST invoices to preview a suggested Scope 3 category and spend-ledger bucket for each line. Heuristic mapping — every row states its confidence; codes we can't parse are left unmapped, never guessed."
      actions={
        <Link
          href="/scope3/boundary"
          className="text-[13px] text-accent hover:text-accent-hover"
        >
          Back to Scope 3 boundary
        </Link>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="space-y-6">
        <PageCard title="GST invoice lines (CSV)">
          <p className="mb-2 text-[12px] text-ink-muted">
            Columns: <span className="font-data">hsn_code</span> (or{" "}
            <span className="font-data">hsn</span> /{" "}
            <span className="font-data">sac</span>, required),{" "}
            <span className="font-data">amount</span> (taxable value, required),{" "}
            <span className="font-data">description</span> (optional).
          </p>
          <textarea
            className={cn(appFieldClass, "min-h-45 font-data")}
            placeholder={SAMPLE_CSV}
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCsvData(SAMPLE_CSV)}
            >
              Load sample
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !csvData.trim()}
              onClick={() => void run(true)}
            >
              Preview mapping
            </Button>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !csvData.trim() || !previewRows}
                onClick={() => void run(false)}
              >
                Commit as spend estimate
              </Button>
            ) : null}
          </div>
        </PageCard>

        {previewRows ? (
          <PageCard title="Preview">
            <p className="mb-3 text-[13px] text-ink">
              {result && result.mode === "preview" ? (
                <>
                  <span className="font-data text-ink">{result.mappedCount}</span> of{" "}
                  <span className="font-data text-ink">{result.count}</span> line(s)
                  mapped to a Scope 3 category ·{" "}
                  <span className="font-data text-ink">{result.pricedCount}</span> priced
                  against an active emissions factor.
                </>
              ) : null}
            </p>
            <ul className="divide-y divide-rule">
              {previewRows.map((row, i) => (
                <li key={`${row.hsnCode}-${i}`} className="py-3 text-[13px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-data text-ink">
                      {row.hsnCode} · ₹{row.amount.toLocaleString("en-IN")}
                    </span>
                    {row.mapped ? (
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">Cat {row.scope3Category}</Badge>
                        <Badge variant={confidenceTone(row.confidence)}>
                          {row.confidence} confidence
                        </Badge>
                      </span>
                    ) : (
                      <Badge variant="rust">unmapped</Badge>
                    )}
                  </div>
                  {row.description ? (
                    <p className="mt-1 text-[12px] text-ink-muted">{row.description}</p>
                  ) : null}
                  {row.mapped ? (
                    <p className="mt-1 text-[12px] text-ink-muted">
                      Ledger <span className="font-data">{row.spendLedgerCategory}</span>{" "}
                      · metric <span className="font-data">{row.metricKey}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-rust">
                      No documented mapping for this HSN/SAC code.
                    </p>
                  )}
                  {row.note ? (
                    <p className="mt-1 text-[11px] text-amber">{row.note}</p>
                  ) : null}
                  {row.emissionsPreview ? (
                    <p className="mt-1 text-[12px] text-ink">
                      Estimated{" "}
                      <span className="font-data">
                        {(row.emissionsPreview.calculatedEmissions / 1000).toFixed(3)}{" "}
                        tCO2e
                      </span>{" "}
                      ({row.emissionsPreview.factorSource},{" "}
                      {row.emissionsPreview.factorRegion}, ±
                      {row.emissionsPreview.uncertainty}%)
                    </p>
                  ) : row.emissionsError ? (
                    <p className="mt-1 text-[12px] text-ink-muted">
                      Not priced — {row.emissionsError}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </PageCard>
        ) : null}

        {commitResult ? (
          <PageCard title="Committed">
            <p className="text-[13px] text-signal">
              Created <span className="font-data">{commitResult.count}</span> spend-based
              emissions record(s), quality <span className="font-data">estimated</span>,
              source <span className="font-data">gst_hsn</span>.
            </p>
            {commitResult.skipped.length > 0 ? (
              <ul className="mt-3 space-y-1 text-[12px] text-amber">
                {commitResult.skipped.map((s, i) => (
                  <li key={i}>
                    {s.hsnCode}: skipped — {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </PageCard>
        ) : null}
      </div>
    </PageFrame>
  );
}
