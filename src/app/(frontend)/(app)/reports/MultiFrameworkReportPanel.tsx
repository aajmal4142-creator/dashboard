"use client";

import { useState, useTransition } from "react";
import { FileStack } from "lucide-react";

import { PageCard, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MultiFrameworkPayload = {
  periodLabel?: string;
  reportingYear?: number;
  frameworksIncluded?: string[];
  frameworksSkipped?: Array<{ framework: string; reason: string }>;
  emissionsOwner?: string | null;
  emissions?: { total: number } | null;
  error?: string;
};

const FRAMEWORK_LABEL: Record<string, string> = {
  csrd: "CSRD",
  tcfd: "TCFD",
  issb: "ISSB",
  gri: "GRI",
};

export function MultiFrameworkReportPanel({
  defaultPeriod,
}: {
  defaultPeriod?: number | string;
}) {
  const initial =
    defaultPeriod != null ? String(defaultPeriod) : String(new Date().getFullYear());
  const [period, setPeriod] = useState(initial);
  const [data, setData] = useState<MultiFrameworkPayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  function loadJson() {
    setStatus("Assembling multi-framework report…");
    setStatusTone("neutral");
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/app/reports/multi-framework/${encodeURIComponent(period)}`,
        );
        const json = (await res.json()) as MultiFrameworkPayload;
        if (!res.ok) {
          setStatus(json.error ?? "Could not assemble multi-framework report.");
          setStatusTone("error");
          setData(null);
          return;
        }
        setData(json);
        const n = json.frameworksIncluded?.length ?? 0;
        setStatus(
          n > 0
            ? `Included ${n} framework${n === 1 ? "" : "s"} for ${json.periodLabel ?? period}. Incomplete frameworks omitted.`
            : `No completed frameworks for ${json.periodLabel ?? period}. Finalise CSRD, TCFD, ISSB, or materiality first.`,
        );
        setStatusTone(n > 0 ? "ok" : "neutral");
      } catch {
        setStatus("Network error loading multi-framework report.");
        setStatusTone("error");
      }
    });
  }

  return (
    <PageCard title="Multi-framework consolidated">
      <p className="mb-3 text-[12px] text-ink-muted">
        Single report from completed CSRD, TCFD, ISSB, and GRI sections. Incomplete
        frameworks are skipped; emissions totals appear once with cross-references.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
          Period (year or period id)
          <input
            className="h-9 min-w-[140px] rounded-[4px] border border-rule bg-surface-1 px-2 font-data text-[13px] text-ink"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            inputMode="numeric"
            aria-label="Reporting period"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !period.trim()}
          onClick={loadJson}
        >
          <FileStack className="size-3.5" aria-hidden />
          Preview
        </Button>
        <Button type="button" size="sm" disabled={pending || !period.trim()} asChild>
          <a
            href={`/api/app/reports/multi-framework/${encodeURIComponent(period)}?format=pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
        </Button>
      </div>

      {status ? (
        <div className="mt-3">
          <StatusLine tone={statusTone}>{status}</StatusLine>
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-3 border-t border-rule pt-3 text-[13px]">
          <p className="text-ink-muted">
            {data.periodLabel} · {data.reportingYear}
            {data.emissionsOwner
              ? ` · emissions owned by ${FRAMEWORK_LABEL[data.emissionsOwner] ?? data.emissionsOwner}`
              : ""}
            {data.emissions
              ? ` · total ${data.emissions.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {(data.frameworksIncluded ?? []).map((fw) => (
              <span
                key={fw}
                className={cn(
                  "rounded-[2px] border border-rule px-2 py-0.5 font-data text-[11px] text-ink",
                )}
              >
                {FRAMEWORK_LABEL[fw] ?? fw}
              </span>
            ))}
          </div>
          {(data.frameworksSkipped ?? []).length > 0 ? (
            <ul className="space-y-1 text-[12px] text-ink-muted">
              {(data.frameworksSkipped ?? []).map((s) => (
                <li key={s.framework}>
                  Skipped {FRAMEWORK_LABEL[s.framework] ?? s.framework}: {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </PageCard>
  );
}
