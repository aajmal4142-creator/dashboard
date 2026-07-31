"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExportFormat = "pdf" | "excel";

type Props = {
  period?: string;
  className?: string;
};

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? fallback;
}

export function ExportChecklistButton({ period, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(format: ExportFormat) {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format });
      if (period) params.set("period", period);
      const res = await fetch(
        `/api/app/compliance/obligations/export?${params.toString()}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const fallback =
        format === "pdf"
          ? `ClearESG_Compliance_${period ?? "export"}.pdf`
          : `ClearESG_Compliance_${period ?? "export"}.xlsx`;
      const filename = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        fallback,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Download className="size-4" aria-hidden />
        {busy ? "Exporting…" : "Export checklist"}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Export checklist format"
          className="absolute right-0 z-20 mt-2 w-56 rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-3 shadow-sm"
        >
          <p className="text-xs text-[color:var(--ink-muted)]">
            Download confirmed obligations as PDF or Excel.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void download("pdf")}
            >
              PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void download("excel")}
            >
              Excel
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-[color:var(--rust)]">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
