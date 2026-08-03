"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { SCOPE3_CATEGORY_LABELS } from "@/lib/scope3/activityHelpers";
import type {
  ActivityDataField,
  EmissionsFactor,
  Scope3Category,
} from "@/lib/scope3/types";
import { cn } from "@/lib/utils";

type PeriodRow = {
  id: string;
  label: string;
  status: string;
  startDate: string;
  endDate: string;
};

type SourceRow = {
  id: string;
  name: string;
  type: Scope3Category;
  emissionsFactor: EmissionsFactor | null;
  activityDataFields: ActivityDataField[];
};

type ActivityRow = {
  id: string;
  sourceId: string;
  sourceName: string;
  category: Scope3Category | null;
  periodId: string;
  periodLabel: string;
  activityData: Record<string, number>;
  activityDataFields: ActivityDataField[];
  emissionsFactor: EmissionsFactor | null;
  calculatedEmissions: number;
  status: "draft" | "validated" | "approved";
  createdAt: string;
  updatedAt: string;
};

type ListPayload = {
  periods: PeriodRow[];
  periodId: string | null;
  sources: SourceRow[];
  activities: ActivityRow[];
  pagination: {
    page: number;
    limit: number;
    totalDocs: number;
    totalPages: number;
  };
  canEdit: boolean;
  message?: string;
  error?: string;
};

type EditDraft = {
  id: string;
  sourceId: string;
  status: ActivityRow["status"];
  fields: Record<string, string>;
};

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function quantitySummary(data: Record<string, number>): string {
  const entries = Object.entries(data);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${formatNum(v)}`).join(" · ");
}

function factorLabel(factor: EmissionsFactor | null): string {
  if (!factor) return "—";
  return `${formatNum(factor.value)} ${factor.unit} (${factor.source}, ${factor.year})`;
}

export function ActivityRecordsClient() {
  const [periodId, setPeriodId] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    (opts?: { periodId?: string; category?: string; status?: string; page?: number }) => {
      startTransition(async () => {
        setError(null);
        setNotice(null);
        const nextPeriod = opts?.periodId ?? periodId;
        const nextCategory = opts?.category ?? category;
        const nextStatus = opts?.status ?? status;
        const nextPage = opts?.page ?? page;

        const params = new URLSearchParams();
        if (nextPeriod) params.set("periodId", nextPeriod);
        if (nextCategory) params.set("category", nextCategory);
        if (nextStatus) params.set("status", nextStatus);
        params.set("page", String(nextPage));
        params.set("limit", "50");

        const res = await fetch(`/api/app/scope3/activities?${params.toString()}`);
        const data = (await res.json().catch(() => ({}))) as ListPayload;
        if (!res.ok) {
          setError(data.error ?? "Could not load activity records.");
          setPayload(null);
          return;
        }
        setPayload(data);
        if (data.periodId) setPeriodId(data.periodId);
      });
    },
    [periodId, category, status, page],
  );

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/app/scope3/activities?limit=50&page=1");
      const data = (await res.json().catch(() => ({}))) as ListPayload;
      if (!res.ok) {
        setError(data.error ?? "Could not load activity records.");
        setPayload(null);
        return;
      }
      setPayload(data);
      if (data.periodId) setPeriodId(data.periodId);
    });
  }, []);

  const openEdit = (row: ActivityRow) => {
    const fields: Record<string, string> = {};
    const fieldDefs =
      row.activityDataFields.length > 0
        ? row.activityDataFields
        : Object.keys(row.activityData).map((name) => ({
            name,
            unit: "",
            description: "",
            required: true,
          }));
    for (const field of fieldDefs) {
      const v = row.activityData[field.name];
      fields[field.name] = v === undefined || v === null ? "" : String(v);
    }
    setEdit({
      id: row.id,
      sourceId: row.sourceId,
      status: row.status,
      fields,
    });
    setNotice(null);
    setError(null);
  };

  const saveEdit = () => {
    if (!edit || !payload?.canEdit) return;
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const activityData: Record<string, string | number> = {};
      for (const [key, raw] of Object.entries(edit.fields)) {
        const trimmed = raw.trim();
        if (trimmed === "") continue;
        const n = Number(trimmed);
        activityData[key] = Number.isFinite(n) ? n : trimmed;
      }

      const res = await fetch(`/api/app/scope3/activities/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityData,
          sourceId: edit.sourceId,
          status: edit.status,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        activity?: ActivityRow;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save activity.");
        return;
      }
      setEdit(null);
      setNotice("Activity updated.");
      load();
    });
  };

  const deleteRow = (id: string) => {
    if (!payload?.canEdit) return;
    if (!window.confirm("Delete this activity record? This cannot be undone.")) {
      return;
    }
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const res = await fetch(`/api/app/scope3/activities/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete activity.");
        return;
      }
      if (edit?.id === id) setEdit(null);
      setNotice("Activity deleted.");
      load();
    });
  };

  const editingSource = edit
    ? payload?.sources.find((s) => s.id === edit.sourceId)
    : null;
  const editFields =
    editingSource?.activityDataFields && editingSource.activityDataFields.length > 0
      ? editingSource.activityDataFields
      : Object.keys(edit?.fields ?? {}).map((name) => ({
          name,
          unit: "",
          description: "",
          required: true,
        }));

  const totalDocs = payload?.pagination.totalDocs ?? 0;
  const totalPages = payload?.pagination.totalPages ?? 0;

  return (
    <PageFrame
      eyebrow="Scope 3"
      title="Activity records"
      help="Generic Scope 3 activity rows imported from CSV or entered against a source. Filter by period and category, edit quantities or the source factor reference, then delete bad rows. Travel and freight have their own dedicated entry screens."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/scope3/import"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            CSV import
          </Link>
          <Link
            href="/scope3/sources"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Sources
          </Link>
          <Link
            href="/scope3"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Scope 3 hub
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => load()}
            disabled={pending}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {notice ? <StatusLine tone="ok">{notice}</StatusLine> : null}

      {!payload && !error ? <PageSkeleton rows={6} /> : null}

      {payload && payload.periods.length === 0 ? (
        <EmptyState
          title="No reporting period"
          body={
            payload.message ??
            "Create a reporting period under Metrics before managing activity records."
          }
        />
      ) : null}

      {payload && payload.periods.length > 0 ? (
        <div className="space-y-6">
          <PageCard title="Filters">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Reporting period
                </span>
                <select
                  className="mt-2 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
                  value={periodId}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPeriodId(next);
                    setPage(1);
                    load({ periodId: next, page: 1 });
                  }}
                >
                  {payload.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.status})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Category
                </span>
                <select
                  className="mt-2 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
                  value={category}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCategory(next);
                    setPage(1);
                    load({ category: next, page: 1 });
                  }}
                >
                  <option value="">All categories</option>
                  {(Object.keys(SCOPE3_CATEGORY_LABELS) as Scope3Category[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {SCOPE3_CATEGORY_LABELS[key]}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Status
                </span>
                <select
                  className="mt-2 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
                  value={status}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStatus(next);
                    setPage(1);
                    load({ status: next, page: 1 });
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="validated">Validated</option>
                  <option value="approved">Approved</option>
                </select>
              </label>

              <div className="flex flex-col justify-end">
                <p className="text-[12px] text-ink-muted">
                  <span className="font-data text-ink">{totalDocs}</span> record
                  {totalDocs === 1 ? "" : "s"}
                  {payload.sources.length > 0 ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-data text-ink">
                        {payload.sources.length}
                      </span>{" "}
                      sources
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          </PageCard>

          {edit ? (
            <PageCard title="Edit activity">
              <div className="space-y-4">
                <label className="block max-w-md">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Source (factor reference)
                  </span>
                  <select
                    className="mt-2 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
                    value={edit.sourceId}
                    disabled={pending}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const nextSource = payload.sources.find((s) => s.id === nextId);
                      const nextFields: Record<string, string> = {};
                      const defs = nextSource?.activityDataFields ?? [];
                      if (defs.length > 0) {
                        for (const field of defs) {
                          nextFields[field.name] = edit.fields[field.name] ?? "";
                        }
                      } else {
                        Object.assign(nextFields, edit.fields);
                      }
                      setEdit({ ...edit, sourceId: nextId, fields: nextFields });
                    }}
                  >
                    {payload.sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {SCOPE3_CATEGORY_LABELS[s.type]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 font-data text-[12px] text-ink-muted">
                    Factor: {factorLabel(editingSource?.emissionsFactor ?? null)}
                  </p>
                </label>

                <label className="block max-w-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Status
                  </span>
                  <select
                    className="mt-2 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
                    value={edit.status}
                    disabled={pending}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        status: e.target.value as ActivityRow["status"],
                      })
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="validated">Validated</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {editFields.map((field) => (
                    <label key={field.name} className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        {field.name}
                        {field.unit ? ` (${field.unit})` : ""}
                        {field.required ? " *" : ""}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="mt-2 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 font-data text-sm text-ink"
                        value={edit.fields[field.name] ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            fields: { ...edit.fields, [field.name]: e.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={saveEdit} disabled={pending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEdit(null)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </PageCard>
          ) : null}

          {payload.activities.length === 0 ? (
            <EmptyState
              title="No activity records"
              body="Import a CSV against a Scope 3 source, or create sources first. Travel and freight entry stays on their dedicated pages."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/scope3/import">
                    <Button type="button">CSV import</Button>
                  </Link>
                  <Link href="/scope3/sources">
                    <Button type="button" variant="outline">
                      Manage sources
                    </Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <PageCard title="Records">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-rule-strong text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      <th className="px-2 py-2 font-semibold">Source</th>
                      <th className="px-2 py-2 font-semibold">Category</th>
                      <th className="px-2 py-2 font-semibold">Quantity</th>
                      <th className="px-2 py-2 font-semibold">Factor</th>
                      <th className="px-2 py-2 font-semibold">tCO2e</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.activities.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-rule align-top",
                          edit?.id === row.id && "bg-surface-2",
                        )}
                      >
                        <td className="px-2 py-3 text-ink">{row.sourceName}</td>
                        <td className="px-2 py-3 text-ink-muted">
                          {row.category ? SCOPE3_CATEGORY_LABELS[row.category] : "—"}
                        </td>
                        <td className="px-2 py-3 font-data text-ink">
                          {quantitySummary(row.activityData)}
                        </td>
                        <td className="px-2 py-3 font-data text-[12px] text-ink-muted">
                          {factorLabel(row.emissionsFactor)}
                        </td>
                        <td className="px-2 py-3 font-data text-ink">
                          {formatNum(row.calculatedEmissions)}
                        </td>
                        <td className="px-2 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                            {row.status}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          {payload.canEdit ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="text-sm text-accent underline-offset-2 hover:underline"
                                disabled={pending}
                                onClick={() => openEdit(row)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-sm text-rust underline-offset-2 hover:underline"
                                disabled={pending}
                                onClick={() => deleteRow(row.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-ink-muted">View only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
                  <p className="text-[12px] text-ink-muted">
                    Page{" "}
                    <span className="font-data text-ink">{payload.pagination.page}</span>{" "}
                    of <span className="font-data text-ink">{totalPages}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || payload.pagination.page <= 1}
                      onClick={() => {
                        const next = payload.pagination.page - 1;
                        setPage(next);
                        load({ page: next });
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || payload.pagination.page >= totalPages}
                      onClick={() => {
                        const next = payload.pagination.page + 1;
                        setPage(next);
                        load({ page: next });
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </PageCard>
          )}
        </div>
      ) : null}
    </PageFrame>
  );
}
