"use client";

import { useEffect, useState, useTransition } from "react";
import { Download } from "lucide-react";

import { PageCard, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CONSOLIDATION_METHOD_LABELS } from "@/lib/consolidation/consolidate";
import { cn } from "@/lib/utils";

type ConsolidatedOrg = {
  organisationId: string;
  organisationName: string;
  depth: number;
  ownershipPercent: number;
  pathFactor: number;
  consolidationMethod: keyof typeof CONSOLIDATION_METHOD_LABELS;
  consolidated: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
  };
  hasData: boolean;
};

type ConsolidatedPayload = {
  period: string;
  total: number;
  by_scope: { scope1: number; scope2: number; scope3: number };
  by_org: ConsolidatedOrg[];
  by_category: Array<{ category: string; emissions: number }>;
  unconsolidated_child_list: Array<{
    organisationId: string;
    organisationName: string;
    reason: string;
  }>;
  methods_used: Array<keyof typeof CONSOLIDATION_METHOD_LABELS>;
  warnings: string[];
  footer: string;
  has_subsidiaries: boolean;
  error?: string;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function ConsolidatedReportPanel({ defaultPeriod }: { defaultPeriod?: number }) {
  const year = defaultPeriod ?? new Date().getFullYear();
  const [includeSubsidiaries, setIncludeSubsidiaries] = useState(false);
  const [period, setPeriod] = useState(String(year));
  const [data, setData] = useState<ConsolidatedPayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      if (!includeSubsidiaries) {
        setData(null);
        setStatus(null);
        return;
      }
      setStatus("Loading consolidated report…");
      setStatusTone("neutral");
      try {
        const res = await fetch(
          `/api/app/reports/consolidated?period=${encodeURIComponent(period)}`,
        );
        const json = (await res.json()) as ConsolidatedPayload;
        if (!res.ok) {
          setStatus(json.error ?? "Could not load consolidated report.");
          setStatusTone("error");
          setData(null);
          return;
        }
        setData(json);
        setStatus(
          json.has_subsidiaries
            ? `Consolidated ${json.period}: ${fmt(json.total)} tCO2e`
            : `No subsidiaries linked under this organisation for ${json.period}. Set a parent on child orgs in Settings → Org hierarchy.`,
        );
        setStatusTone(json.has_subsidiaries ? "ok" : "neutral");
      } catch {
        setStatus("Network error loading consolidated report.");
        setStatusTone("error");
      }
    });
  }

  useEffect(() => {
    void Promise.resolve().then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when toggle/period change
  }, [includeSubsidiaries, period]);

  async function downloadCsv() {
    try {
      const res = await fetch(
        `/api/app/reports/consolidated?period=${encodeURIComponent(period)}&format=csv`,
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(json.error ?? "CSV export failed.");
        setStatusTone("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consolidated-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus("Network error exporting CSV.");
      setStatusTone("error");
    }
  }

  return (
    <PageCard title="Multi-org consolidation">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
          <Checkbox
            checked={includeSubsidiaries}
            onCheckedChange={(v) => setIncludeSubsidiaries(v === true)}
          />
          Include subsidiaries
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-muted">
          Period
          <input
            type="number"
            className="w-20 rounded-[4px] border border-rule bg-surface-1 px-2 py-1 font-data text-sm text-ink"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            min={1990}
            max={2100}
            disabled={!includeSubsidiaries || pending}
          />
        </label>
        {includeSubsidiaries ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void downloadCsv()}
          >
            <Download className="mr-1.5 size-3.5" aria-hidden />
            Export CSV
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-ink-muted">
        Only organisations with an explicit consolidation parent and Membership access are
        included.{" "}
        <a href="/settings/org-hierarchy" className="editorial-link text-accent">
          Manage hierarchy
        </a>
      </p>

      {status ? (
        <div className="mt-3">
          <StatusLine tone={statusTone}>{status}</StatusLine>
        </div>
      ) : null}

      {includeSubsidiaries && data ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ["Total", data.total],
                ["Scope 1", data.by_scope.scope1],
                ["Scope 2", data.by_scope.scope2],
                ["Scope 3", data.by_scope.scope3],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border-b border-rule pb-2">
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                  {label}
                </p>
                <p className="mt-1 font-data text-lg text-ink">{fmt(value)}</p>
              </div>
            ))}
          </div>

          {data.warnings.length > 0 ? (
            <ul className="space-y-1 border border-amber/40 bg-amber/10 px-3 py-2 text-[12px] text-ink">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Breakdown by organisation
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                    <th className="py-2 pr-3 font-medium">Organisation</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 pr-3 font-medium">Own %</th>
                    <th className="py-2 pr-3 font-medium">Factor</th>
                    <th className="py-2 font-medium">tCO2e</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_org.map((row) => (
                    <tr key={row.organisationId} className="border-b border-rule">
                      <td
                        className="py-2 pr-3 text-ink"
                        style={{ paddingLeft: `${row.depth * 12}px` }}
                      >
                        {row.organisationName}
                      </td>
                      <td className="py-2 pr-3 text-[12px] text-ink-muted">
                        {row.depth === 0
                          ? "—"
                          : CONSOLIDATION_METHOD_LABELS[row.consolidationMethod]}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.depth === 0 ? "—" : `${row.ownershipPercent}%`}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.pathFactor.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-2 font-data",
                          row.hasData ? "text-ink" : "text-amber",
                        )}
                      >
                        {fmt(row.consolidated.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.by_category.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                By category
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {data.by_category.slice(0, 12).map((c) => (
                  <li
                    key={c.category}
                    className="flex justify-between gap-4 border-b border-rule py-1.5"
                  >
                    <span className="text-ink">{c.category}</span>
                    <span className="font-data text-ink-muted">{fmt(c.emissions)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-rule pt-3 text-[12px] text-ink-muted">
            {data.footer}
          </p>
        </div>
      ) : null}
    </PageCard>
  );
}
