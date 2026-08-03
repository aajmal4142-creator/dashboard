"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  REDUCTION_PROJECT_STATUSES,
  REDUCTION_STATUS_LABELS,
  type FacilityOption,
  type ReductionProjectDto,
  type ReductionProjectStatus,
  type ReductionProjectSummary,
} from "@/lib/analytics/reduction";
import { cn } from "@/lib/utils";

type ListPayload = {
  projects: ReductionProjectDto[];
  summary: ReductionProjectSummary;
  facilities: FacilityOption[];
  canWrite?: boolean;
  canDelete?: boolean;
  error?: string;
};

type FormState = {
  title: string;
  status: ReductionProjectStatus;
  plannedReductionTco2e: string;
  actualReductionTco2e: string;
  owner: string;
  startDate: string;
  endDate: string;
  facilityId: string;
  metricKey: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    status: "planned",
    plannedReductionTco2e: "",
    actualReductionTco2e: "",
    owner: "",
    startDate: "",
    endDate: "",
    facilityId: "",
    metricKey: "",
    notes: "",
  };
}

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function statusClass(status: ReductionProjectStatus): string {
  if (status === "completed") return "text-[color:var(--signal)]";
  if (status === "in_progress") return "text-[color:var(--cobalt)]";
  if (status === "cancelled") return "text-[color:var(--ink-muted)]";
  return "text-[color:var(--amber)]";
}

function qualityLabel(quality: ReductionProjectSummary["quality"]): string {
  if (quality === "measured") return "Measured";
  if (quality === "partial") return "Partial";
  return "Missing actuals";
}

export function ReductionProjectsClient(props: {
  orgName: string;
  canWrite: boolean;
  canDelete: boolean;
  eyebrow: string;
  title: string;
  help: string;
}) {
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
        const res = await fetch(`/api/app/analytics/reduction-projects${qs}`);
        const json = (await res.json()) as ListPayload;
        if (!res.ok) {
          setError(json.error ?? "Could not load reduction projects");
          setPayload(null);
          return;
        }
        setPayload(json);
        if (selectedId && !json.projects.some((p) => p.id === selectedId)) {
          setSelectedId(null);
        }
      } catch {
        setError("Network error loading reduction projects. Retry.");
        setPayload(null);
      }
    });
  }, [statusFilter, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const canWrite = payload?.canWrite ?? props.canWrite;
  const canDelete = payload?.canDelete ?? props.canDelete;
  const selected = payload?.projects.find((p) => p.id === selectedId) ?? null;
  const summary = payload?.summary;
  const facilities = payload?.facilities ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(project: ReductionProjectDto) {
    setEditingId(project.id);
    setForm({
      title: project.title,
      status: project.status,
      plannedReductionTco2e: String(project.plannedReductionTco2e),
      actualReductionTco2e:
        project.actualReductionTco2e === null ? "" : String(project.actualReductionTco2e),
      owner: project.owner,
      startDate: project.startDate ?? "",
      endDate: project.endDate ?? "",
      facilityId: project.facilityId ?? "",
      metricKey: project.metricKey ?? "",
      notes: project.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveProject() {
    setFormError(null);
    const planned = Number(form.plannedReductionTco2e);
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!form.owner.trim()) {
      setFormError("Owner is required.");
      return;
    }
    if (!Number.isFinite(planned) || planned < 0) {
      setFormError("Planned reduction must be a non-negative number.");
      return;
    }
    const actualRaw = form.actualReductionTco2e.trim();
    let actualReductionTco2e: number | null = null;
    if (actualRaw !== "") {
      const n = Number(actualRaw);
      if (!Number.isFinite(n) || n < 0) {
        setFormError("Actual reduction must be a non-negative number when provided.");
        return;
      }
      actualReductionTco2e = n;
    }

    const body = {
      title: form.title.trim(),
      status: form.status,
      plannedReductionTco2e: planned,
      actualReductionTco2e,
      owner: form.owner.trim(),
      startDate: form.startDate.trim() || null,
      endDate: form.endDate.trim() || null,
      facilityId: form.facilityId.trim() || null,
      metricKey: form.metricKey.trim() || null,
      notes: form.notes.trim() || null,
    };

    const res = await fetch(
      editingId
        ? `/api/app/analytics/reduction-projects/${editingId}`
        : "/api/app/analytics/reduction-projects",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      project?: ReductionProjectDto;
    };
    if (!res.ok) {
      setFormError(json.error ?? "Could not save project.");
      return;
    }
    setFormOpen(false);
    if (json.project) setSelectedId(json.project.id);
    load();
  }

  async function deleteProject(id: string) {
    if (!canDelete) return;
    if (!window.confirm("Delete this reduction project? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/app/analytics/reduction-projects/${id}`, {
      method: "DELETE",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not delete project.");
      return;
    }
    if (selectedId === id) setSelectedId(null);
    load();
  }

  return (
    <PageFrame
      eyebrow={props.eyebrow}
      title={props.title}
      help={props.help}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/facilities"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Facilities
          </Link>
          <Link
            href="/analytics"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Analytics
          </Link>
          <Button type="button" variant="outline" onClick={load} disabled={pending}>
            Refresh
          </Button>
          {canWrite ? (
            <Button type="button" onClick={openCreate} disabled={pending}>
              <Plus className="size-4" aria-hidden />
              New project
            </Button>
          ) : null}
        </div>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {!canWrite ? (
        <StatusLine tone="neutral">
          View only — ask a contributor or admin to edit reduction projects.
        </StatusLine>
      ) : null}

      {!payload && !error ? <PageSkeleton /> : null}

      {payload ? (
        <div className="space-y-6">
          {summary ? (
            <div className="grid gap-4 border-b border-[color:var(--rule)] pb-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="label-caps text-[color:var(--ink-muted)]">Projects</p>
                <p className="mt-1 text-2xl text-[color:var(--ink)]">
                  <Mono>{summary.projectCount}</Mono>
                </p>
              </div>
              <div>
                <p className="label-caps text-[color:var(--ink-muted)]">
                  Planned total (tCO₂e)
                </p>
                <p className="mt-1 text-2xl text-[color:var(--ink)]">
                  <Mono>{formatNum(summary.plannedTotalTco2e)}</Mono>
                </p>
              </div>
              <div>
                <p className="label-caps text-[color:var(--ink-muted)]">
                  Actual total (tCO₂e)
                </p>
                <p className="mt-1 text-2xl text-[color:var(--ink)]">
                  <Mono>{formatNum(summary.actualTotalTco2e)}</Mono>
                </p>
                <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                  {qualityLabel(summary.quality)}
                  {summary.projectsMissingActual > 0
                    ? ` · ${summary.projectsMissingActual} missing`
                    : null}
                </p>
              </div>
              <div>
                <p className="label-caps text-[color:var(--ink-muted)]">
                  Variance vs planned with actuals
                </p>
                <p className="mt-1 text-2xl text-[color:var(--ink)]">
                  <Mono>{formatNum(summary.varianceTco2e)}</Mono>
                </p>
              </div>
            </div>
          ) : null}

          {summary?.message ? (
            <StatusLine tone="neutral">{summary.message}</StatusLine>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <AppSelectNative
              label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {REDUCTION_PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REDUCTION_STATUS_LABELS[s]}
                </option>
              ))}
            </AppSelectNative>
          </div>

          {payload.projects.length === 0 ? (
            <EmptyState
              title="No reduction projects yet"
              body="Track mitigation projects with planned versus measured tCO₂e. Leave actual blank until measured — summaries never invent zero."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="overflow-x-auto border-t border-[color:var(--rule)]">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--rule)] text-xs text-[color:var(--ink-muted)]">
                      <th className="py-2 pr-3 font-normal">Title</th>
                      <th className="py-2 pr-3 font-normal">Status</th>
                      <th className="py-2 pr-3 font-normal">Owner</th>
                      <th className="py-2 pr-3 font-normal text-right">Planned</th>
                      <th className="py-2 pr-3 font-normal text-right">Actual</th>
                      <th className="py-2 font-normal"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.projects.map((project) => (
                      <tr
                        key={project.id}
                        className={cn(
                          "border-b border-[color:var(--rule)] cursor-pointer",
                          selectedId === project.id
                            ? "bg-[color:var(--surface-2)]"
                            : "hover:bg-[color:var(--surface-2)]",
                        )}
                        onClick={() => setSelectedId(project.id)}
                      >
                        <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                          {project.title}
                        </td>
                        <td className={cn("py-2.5 pr-3", statusClass(project.status))}>
                          {REDUCTION_STATUS_LABELS[project.status]}
                        </td>
                        <td className="py-2.5 pr-3 text-[color:var(--ink-muted)]">
                          {project.owner}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Mono>{formatNum(project.plannedReductionTco2e)}</Mono>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Mono>{formatNum(project.actualReductionTco2e)}</Mono>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {canWrite ? (
                              <button
                                type="button"
                                className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-1)] hover:text-[color:var(--ink)]"
                                aria-label={`Edit ${project.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(project);
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-1)] hover:text-[color:var(--rust)]"
                                aria-label={`Delete ${project.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteProject(project.id);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <aside className="border border-[color:var(--rule)] rounded-[6px] p-4 bg-[color:var(--surface-1)]">
                {selected ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="label-caps text-[color:var(--ink-muted)]">Detail</p>
                        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                          {selected.title}
                        </h2>
                      </div>
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(selected)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </div>
                    <dl className="grid gap-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Status</dt>
                        <dd className={statusClass(selected.status)}>
                          {REDUCTION_STATUS_LABELS[selected.status]}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Owner</dt>
                        <dd className="text-[color:var(--ink)]">{selected.owner}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Planned</dt>
                        <dd>
                          <Mono>{formatNum(selected.plannedReductionTco2e)} tCO₂e</Mono>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Actual</dt>
                        <dd>
                          <Mono>{formatNum(selected.actualReductionTco2e)} tCO₂e</Mono>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Start</dt>
                        <dd className="text-[color:var(--ink)]">
                          {selected.startDate ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">End</dt>
                        <dd className="text-[color:var(--ink)]">
                          {selected.endDate ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Facility</dt>
                        <dd className="text-right text-[color:var(--ink)]">
                          {selected.facilityId ? (
                            <Link
                              href="/facilities"
                              className="text-accent underline-offset-2 hover:underline"
                            >
                              {selected.facilityName ?? selected.facilityId}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[color:var(--ink-muted)]">Metric key</dt>
                        <dd className="text-right">
                          {selected.metricKey ? (
                            <Mono className="text-[color:var(--ink)]">
                              {selected.metricKey}
                            </Mono>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                    </dl>
                    {selected.notes ? (
                      <p className="border-t border-[color:var(--rule)] pt-3 text-sm text-[color:var(--ink-muted)]">
                        {selected.notes}
                      </p>
                    ) : null}
                    <p className="text-xs text-[color:var(--ink-muted)]">
                      {props.orgName}
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    title="Select a project"
                    body="Choose a row to see dates, facility, metric link, and notes."
                  />
                )}
              </aside>
            </div>
          )}
        </div>
      ) : null}

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reduction-project-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="reduction-project-form-title"
                className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
              >
                {editingId ? "Edit project" : "New project"}
              </h2>
              <button
                type="button"
                className="rounded-[4px] p-1 text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
                aria-label="Close"
                onClick={() => setFormOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}

            <div className="mt-3 grid gap-3">
              <AppField
                label="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <AppSelectNative
                label="Status"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as ReductionProjectStatus,
                  }))
                }
              >
                {REDUCTION_PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REDUCTION_STATUS_LABELS[s]}
                  </option>
                ))}
              </AppSelectNative>
              <div className="grid gap-3 sm:grid-cols-2">
                <AppField
                  label="Planned reduction (tCO₂e)"
                  type="number"
                  min={0}
                  step="any"
                  className="font-[family-name:var(--font-mono)]"
                  value={form.plannedReductionTco2e}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plannedReductionTco2e: e.target.value,
                    }))
                  }
                  required
                />
                <AppField
                  label="Actual reduction (tCO₂e)"
                  type="number"
                  min={0}
                  step="any"
                  className="font-[family-name:var(--font-mono)]"
                  value={form.actualReductionTco2e}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      actualReductionTco2e: e.target.value,
                    }))
                  }
                  placeholder="Leave blank if unknown"
                />
              </div>
              <AppField
                label="Owner"
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <AppField
                  label="Start date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                <AppField
                  label="End date"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              <AppSelectNative
                label="Facility (optional)"
                value={form.facilityId}
                onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))}
              >
                <option value="">None</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </AppSelectNative>
              <AppField
                label="Metric key (optional)"
                value={form.metricKey}
                onChange={(e) => setForm((f) => ({ ...f, metricKey: e.target.value }))}
                placeholder="e.g. electricity_kwh"
              />
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                <span className="label-caps">Notes</span>
                <textarea
                  className="min-h-[80px] w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveProject()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
