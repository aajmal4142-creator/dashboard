"use client";

import Link from "next/link";
import { useState } from "react";

import { PageCard, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { appFieldClass } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImportRowResult = {
  rowNumber: number;
  status: "updated" | "not_found" | "ambiguous" | "error";
  supplierId?: string;
  supplierName?: string;
  message?: string;
};

type ImportResponse = {
  mode: "preview" | "commit";
  matched: number;
  totalRows: number;
  results: ImportRowResult[];
  csvErrors: Array<{ rowNumber: number; field: string; error: string }>;
  error?: string;
};

const SAMPLE_CSV = [
  "supplier_id,supplier_name,sbti_status,enforcement_flag,sources,notes",
  ",Acme Supplies Ltd,committed,false,https://sciencebasedtargets.org/companies-taking-action,Verified against public SBTi list",
].join("\n");

function statusTone(status: ImportRowResult["status"]): string {
  if (status === "updated") return "text-signal";
  if (status === "error") return "text-rust";
  return "text-amber";
}

export function RegistryRiskImportClient() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/suppliers/registry-risk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
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

  return (
    <PageFrame
      eyebrow="Supply chain"
      title="Import public-registry risk flags"
      help="Paste a CSV of Y08 public-registry flags (sbti_status, enforcement_flag) matched to suppliers by supplier_id or supplier_name. Operator-sourced only — never invented, never a numeric score."
      actions={
        <Link
          href="/suppliers"
          className="text-[13px] text-accent hover:text-accent-hover"
        >
          Back to suppliers
        </Link>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="space-y-6">
        <PageCard title="CSV">
          <p className="mb-2 text-[12px] text-ink-muted">
            Columns: <span className="font-data">supplier_id</span> or{" "}
            <span className="font-data">supplier_name</span> (required),{" "}
            <span className="font-data">sbti_status</span> (committed / targets_set / none
            / unknown), <span className="font-data">enforcement_flag</span> (true / false
            / unknown), <span className="font-data">sources</span> (semicolon-separated),{" "}
            <span className="font-data">notes</span>.
          </p>
          <textarea
            className={cn(appFieldClass, "min-h-[200px] font-data")}
            placeholder={SAMPLE_CSV}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCsv(SAMPLE_CSV)}
            >
              Load sample
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !csv.trim()}
              onClick={() => void run(true)}
            >
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !csv.trim() || !result}
              onClick={() => void run(false)}
            >
              Commit import
            </Button>
          </div>
        </PageCard>

        {result ? (
          <PageCard title={result.mode === "preview" ? "Preview" : "Import result"}>
            <p className="mb-3 text-[13px] text-ink">
              {result.matched} of {result.totalRows} row(s) matched a supplier in this
              organisation.
            </p>
            {result.csvErrors.length > 0 ? (
              <ul className="mb-3 space-y-1 text-[12px] text-rust">
                {result.csvErrors.map((e, i) => (
                  <li key={i}>
                    Row {e.rowNumber}: {e.error}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="divide-y divide-rule text-[13px]">
              {result.results.map((r) => (
                <li
                  key={r.rowNumber}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                >
                  <span>
                    Row {r.rowNumber} · {r.supplierName ?? r.supplierId ?? "—"}
                  </span>
                  <span className={statusTone(r.status)}>
                    {r.status}
                    {r.message ? ` — ${r.message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </PageCard>
        ) : null}
      </div>
    </PageFrame>
  );
}
