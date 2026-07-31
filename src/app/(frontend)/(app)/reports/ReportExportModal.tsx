"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_PDF_EXPORT_SETTINGS,
  buildPdfExportQuery,
  type ReportPdfExportSettings,
} from "@/lib/reports/pdfSettings";

type ExportMode = "menu" | "pdf-options" | "html-preview";

export function ReportExportModal({
  open,
  onOpenChange,
  reportId,
  reportLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportLabel: string;
}) {
  const [mode, setMode] = useState<ExportMode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfSettings, setPdfSettings] = useState<ReportPdfExportSettings>(
    DEFAULT_PDF_EXPORT_SETTINGS,
  );

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("menu");
      setError(null);
      setPreviewUrl(null);
      setBusy(false);
      setPdfSettings(DEFAULT_PDF_EXPORT_SETTINGS);
    }
    onOpenChange(next);
  }

  async function openHtmlPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/reports/${reportId}/html?json=1`);
      const data = (await res.json().catch(() => ({}))) as {
        previewUrl?: string;
        htmlUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not open HTML report");
        return;
      }
      setPreviewUrl(
        data.previewUrl ?? data.htmlUrl ?? `/reports/${reportId}/html?embed=1`,
      );
      setMode("html-preview");
    } finally {
      setBusy(false);
    }
  }

  const pdfHref = `/api/app/reports/${reportId}/pdf${buildPdfExportQuery(pdfSettings)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-rule bg-surface-1 text-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "menu"
              ? "Export report"
              : mode === "pdf-options"
                ? "PDF options"
                : "HTML preview"}
          </DialogTitle>
          <p className="text-sm text-ink-muted">{reportLabel}</p>
        </DialogHeader>

        {error ? <p className="text-sm text-rust">{error}</p> : null}

        {mode === "menu" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              onClick={() => setMode("pdf-options")}
            >
              <span className="label-caps text-accent">PDF</span>
              <p className="mt-2 text-ink-muted">Printable locked document</p>
            </button>
            <button
              type="button"
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              disabled={busy}
              onClick={() => void openHtmlPreview()}
            >
              <span className="label-caps text-accent">HTML</span>
              <p className="mt-2 text-ink-muted">Interactive preview</p>
            </button>
            <a
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              href={`/api/app/reports/${reportId}/export?format=xlsx`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="label-caps text-accent">Excel</span>
              <p className="mt-2 text-ink-muted">Multi-sheet workbook (.xlsx)</p>
            </a>
            <a
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              href={`/api/app/reports/${reportId}/export?format=csv`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="label-caps text-accent">CSV</span>
              <p className="mt-2 text-ink-muted">Summary metrics spreadsheet</p>
            </a>
            <a
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              href={`/api/app/reports/${reportId}/export?format=json`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="label-caps text-accent">JSON</span>
              <p className="mt-2 text-ink-muted">BI tools, APIs, databases</p>
            </a>
            <a
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              href={`/api/app/reports/${reportId}/export?format=xml`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="label-caps text-accent">XML</span>
              <p className="mt-2 text-ink-muted">Legacy systems, EDI</p>
            </a>
          </div>
        ) : null}

        {mode === "pdf-options" ? (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="label-caps text-ink-muted">Page size</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "a4", label: "A4" },
                    { id: "letter", label: "US Letter" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={
                      pdfSettings.pageFormat === opt.id
                        ? "rounded-[4px] border border-accent bg-accent-quiet px-3 py-1.5 text-sm text-ink"
                        : "rounded-[4px] border border-rule px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface-2"
                    }
                    onClick={() => setPdfSettings((s) => ({ ...s, pageFormat: opt.id }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 accent-accent"
                checked={pdfSettings.watermark === "CONFIDENTIAL"}
                onChange={(e) =>
                  setPdfSettings((s) => ({
                    ...s,
                    watermark: e.target.checked ? "CONFIDENTIAL" : null,
                  }))
                }
              />
              <span>
                Confidential watermark
                <span className="mt-0.5 block text-ink-muted">
                  Overlay text. Free plans also keep the ClearESG draft mark.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 accent-accent"
                checked={pdfSettings.includeCharts}
                onChange={(e) =>
                  setPdfSettings((s) => ({
                    ...s,
                    includeCharts: e.target.checked,
                  }))
                }
              />
              <span>
                Include charts
                <span className="mt-0.5 block text-ink-muted">
                  Gauge and scope stack bar on the PDF.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
              <Button type="button" asChild>
                <a href={pdfHref} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode("menu")}>
                Back
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "html-preview" && previewUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[6px] border border-rule">
              <iframe
                title="HTML report preview"
                src={previewUrl}
                className="h-[420px] w-full bg-canvas"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(`/reports/${reportId}/html`, "_blank")}
              >
                Open full page
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode("menu")}>
                Back
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
