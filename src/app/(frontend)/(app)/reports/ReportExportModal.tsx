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

type ExportMode = "menu" | "html-preview";

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

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("menu");
      setError(null);
      setPreviewUrl(null);
      setBusy(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-rule bg-surface-1 text-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "menu" ? "Export report" : "HTML preview"}
          </DialogTitle>
          <p className="text-sm text-ink-muted">{reportLabel}</p>
        </DialogHeader>

        {error ? <p className="text-sm text-rust">{error}</p> : null}

        {mode === "menu" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              className="rounded-[6px] border border-rule px-3 py-4 text-center text-sm text-ink transition-colors hover:bg-surface-2"
              href={`/api/app/reports/${reportId}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="label-caps text-accent">PDF</span>
              <p className="mt-2 text-ink-muted">Printable locked document</p>
            </a>
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
