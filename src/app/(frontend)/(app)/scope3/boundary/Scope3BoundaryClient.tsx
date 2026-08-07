"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { appFieldClass, AppSelectNative } from "@/components/ui/AppField";
import { Badge } from "@/components/ui/badge";
import {
  summariseScope3Boundary,
  type Scope3BoundaryRow,
  type Scope3BoundaryStatus,
} from "@/lib/scope3/boundary";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: Scope3BoundaryStatus; label: string }> = [
  { value: "not_assessed", label: "Not assessed" },
  { value: "included", label: "Included" },
  { value: "excluded", label: "Excluded" },
];

function statusBadgeVariant(status: Scope3BoundaryStatus): "signal" | "amber" | "rust" {
  if (status === "included") return "signal";
  if (status === "excluded") return "rust";
  return "amber";
}

export function Scope3BoundaryClient({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Scope3BoundaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/app/scope3/boundary");
      const data = (await res.json().catch(() => ({}))) as {
        matrix?: Scope3BoundaryRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load Scope 3 boundary.");
        return;
      }
      setRows(data.matrix ?? []);
    } catch {
      setError("Network error loading boundary. Retry.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      startTransition(() => {
        void load();
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const summary = useMemo(() => (rows ? summariseScope3Boundary(rows) : null), [rows]);

  async function save(
    category: number,
    patch: { status?: Scope3BoundaryStatus; rationale?: string | null },
  ) {
    if (!canWrite) return;
    setSavingCategory(category);
    setSaveError(null);
    try {
      const res = await fetch("/api/app/scope3/boundary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, ...patch }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(data.error ?? "Could not save.");
        return;
      }
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.number === category
                ? {
                    ...r,
                    status: patch.status ?? r.status,
                    rationale:
                      patch.rationale !== undefined ? patch.rationale : r.rationale,
                    isUndecided: (patch.status ?? r.status) === "not_assessed",
                  }
                : r,
            )
          : prev,
      );
    } catch {
      setSaveError("Network error saving. Retry.");
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <PageFrame
      eyebrow="Scope 3"
      title="Organisational boundary — Cat 1–15"
      help="Every GHG Protocol Scope 3 category, with your inclusion/exclusion decision and rationale. Categories without a decision are 'not assessed' — never silently included or excluded."
      actions={
        <>
          <Link
            href="/scope3/gst-hsn"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            GST/HSN mapper (India)
          </Link>
          <Link
            href="/scope3"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Back to Scope 3
          </Link>
        </>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {saveError ? <StatusLine tone="error">{saveError}</StatusLine> : null}
      {!rows && !error ? <PageSkeleton rows={8} /> : null}

      {rows ? (
        <div className="space-y-4">
          {summary ? (
            <div className="flex flex-wrap gap-4 text-[13px] text-ink-muted">
              <span>
                <span className="font-data text-ink">{summary.included}</span> included
              </span>
              <span>
                <span className="font-data text-ink">{summary.excluded}</span> excluded
              </span>
              <span>
                <span className="font-data text-ink">{summary.notAssessed}</span> not
                assessed
              </span>
            </div>
          ) : null}

          <div className="space-y-3">
            {rows.map((row) => (
              <PageCard key={row.number}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-data text-[12px] text-ink-muted">
                        Cat {row.number}
                      </span>
                      <Badge variant="outline">{row.direction}</Badge>
                      <Badge variant={statusBadgeVariant(row.status)}>
                        {STATUS_OPTIONS.find((o) => o.value === row.status)?.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[15px] font-medium text-ink">{row.name}</p>
                    <p className="mt-1 max-w-[66ch] text-[12px] text-ink-muted">
                      {row.description}
                    </p>
                    {row.surfaceHref ? (
                      <Link
                        href={row.surfaceHref}
                        className="mt-2 inline-block text-[12px] text-accent underline-offset-2 hover:underline"
                      >
                        {row.surfaceLabel} ↗
                      </Link>
                    ) : (
                      <Link
                        href="/spend"
                        className="mt-2 inline-block text-[12px] text-accent underline-offset-2 hover:underline"
                      >
                        Data via Metrics / spend ↗
                      </Link>
                    )}
                  </div>

                  <div className="w-full max-w-[220px] shrink-0 sm:w-[220px]">
                    <AppSelectNative
                      label="Status"
                      value={row.status}
                      disabled={!canWrite || savingCategory === row.number}
                      onChange={(e) =>
                        void save(row.number, {
                          status: e.target.value as Scope3BoundaryStatus,
                        })
                      }
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </AppSelectNative>
                  </div>
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                  <span className="label-caps">
                    Rationale
                    {row.status === "excluded" ? " (required for exclusions)" : ""}
                  </span>
                  <textarea
                    className={cn(appFieldClass, "min-h-[56px]")}
                    defaultValue={row.rationale ?? ""}
                    disabled={!canWrite}
                    placeholder="Why included/excluded — screening result, materiality, data availability…"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== (row.rationale ?? "")) {
                        void save(row.number, { rationale: value ? value : null });
                      }
                    }}
                  />
                </label>
                {row.status === "excluded" && !row.rationale?.trim() ? (
                  <p className="mt-1 text-[11px] text-amber">
                    Excluded without a documented rationale.
                  </p>
                ) : null}
              </PageCard>
            ))}
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
