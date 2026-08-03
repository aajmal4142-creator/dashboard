"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DownloadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok" };

/**
 * One-click board / investor audience pack download (F36).
 * Posts to /api/app/reports/audience-pack. Distinct from F17 evidence pack.
 */
export function AudiencePackDownloadButton({
  reportId,
  periodId,
  format = "zip",
  className,
  appearance = "button",
}: {
  reportId?: string | null;
  periodId?: string | null;
  format?: "zip" | "pdf" | "csv";
  className?: string;
  /** `link` matches Reports row actions; `button` matches export modal. */
  appearance?: "button" | "link";
}) {
  const { t } = useI18n();
  const [state, setState] = useState<DownloadState>({ kind: "idle" });

  async function download() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/app/reports/audience-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: reportId ?? undefined,
          periodId: periodId ?? undefined,
          format,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: "error",
          message: data.error ?? t("reports.audiencePackError"),
        });
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `clearesg-board-pack.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState({ kind: "ok" });
    } catch {
      setState({
        kind: "error",
        message: t("reports.audiencePackError"),
      });
    }
  }

  const label =
    state.kind === "loading"
      ? t("reports.audiencePackLoading")
      : t("reports.audiencePackDownload");

  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      {appearance === "link" ? (
        <button
          type="button"
          className="text-accent underline-offset-2 hover:underline disabled:opacity-50"
          disabled={state.kind === "loading"}
          onClick={() => void download()}
          aria-busy={state.kind === "loading"}
        >
          {label}
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={state.kind === "loading"}
          onClick={() => void download()}
          aria-busy={state.kind === "loading"}
        >
          <Download className="mr-1.5 size-3.5" aria-hidden />
          {label}
        </Button>
      )}
      {state.kind === "error" ? (
        <p className="text-[12px] text-rust" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.kind === "ok" && appearance === "button" ? (
        <p className="text-[12px] text-ink-muted">{t("reports.audiencePackOk")}</p>
      ) : null}
    </div>
  );
}
