"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  filterPolicies,
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABELS,
  POLICY_STATUSES,
  POLICY_STATUS_LABELS,
  type PolicyCategory,
  type PolicyRecord,
  type PolicyStatus,
} from "@/lib/policies";
import { cn } from "@/lib/utils";

type ListPayload = {
  policies: PolicyRecord[];
  total: number;
  canWrite?: boolean;
  canDelete?: boolean;
  error?: string;
};

type FormState = {
  title: string;
  category: PolicyCategory;
  status: PolicyStatus;
  version: string;
  owner: string;
  effectiveDate: string;
  documentUrl: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    category: "climate",
    status: "draft",
    version: "1.0",
    owner: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    documentUrl: "",
    notes: "",
  };
}

function statusClass(status: PolicyStatus): string {
  if (status === "active") return "text-[color:var(--signal)]";
  if (status === "retired") return "text-[color:var(--ink-muted)]";
  return "text-[color:var(--amber)]";
}

function Mono({ children }: { children: string }) {
  return (
    <span className="font-[family-name:var(--font-mono)] tabular-nums">{children}</span>
  );
}

export function PoliciesClient({
  orgName,
  canWrite,
  canDelete,
  eyebrow,
  title,
  help,
  emptyTitle,
  emptyHelp,
  errorLoad,
  viewOnly,
}: {
  orgName: string;
  canWrite: boolean;
  canDelete: boolean;
  eyebrow: string;
  title: string;
  help: string;
  emptyTitle: string;
  emptyHelp: string;
  errorLoad: string;
  viewOnly: string;
}) {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState<"" | PolicyCategory>("");
  const [statusFilter, setStatusFilter] = useState<"" | PolicyStatus>("");
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/policy-library");
        const json = (await res.json()) as ListPayload;
        if (!res.ok) {
          setError(json.error ?? errorLoad);
          return;
        }
        setPolicies(json.policies ?? []);
      } catch {
        setError("Network error loading policies. Retry.");
      }
    });
  }, [errorLoad]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      filterPolicies(policies, {
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        query: query || undefined,
      }),
    [policies, categoryFilter, statusFilter, query],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(p: PolicyRecord) {
    setEditingId(p.id);
    setForm({
      title: p.title,
      category: p.category,
      status: p.status,
      version: p.version,
      owner: p.owner,
      effectiveDate: p.effectiveDate || new Date().toISOString().slice(0, 10),
      documentUrl: p.documentUrl ?? "",
      notes: p.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!form.version.trim()) {
      setFormError("Version is required.");
      return;
    }
    if (!form.owner.trim()) {
      setFormError("Owner is required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveDate.trim())) {
      setFormError("Effective date must be YYYY-MM-DD.");
      return;
    }

    const body = {
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      version: form.version.trim(),
      owner: form.owner.trim(),
      effectiveDate: form.effectiveDate.trim(),
      documentUrl: form.documentUrl.trim() || null,
      notes: form.notes.trim() || null,
    };

    const url = editingId
      ? `/api/app/policy-library/${editingId}`
      : "/api/app/policy-library";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(json.error ?? "Could not save policy");
        return;
      }
      setFormOpen(false);
      setStatusMsg(editingId ? "Policy updated." : "Policy created.");
      load();
    } catch {
      setFormError("Network error saving policy. Retry.");
    }
  }

  async function removePolicy(id: string) {
    try {
      const res = await fetch(`/api/app/policy-library/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatusMsg(json.error ?? "Could not delete policy");
        return;
      }
      setStatusMsg("Policy deleted.");
      load();
    } catch {
      setStatusMsg("Network error deleting policy. Retry.");
    }
  }

  if (!policies.length && pending && !error) {
    return (
      <PageFrame eyebrow={eyebrow} title={title} help={help}>
        <PageSkeleton />
      </PageFrame>
    );
  }

  return (
    <PageFrame eyebrow={eyebrow} title={title} help={help}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--rule)] pb-3">
        <p className="text-xs text-[color:var(--ink-muted)]">
          {orgName}
          {pending ? " · Loading…" : null}
        </p>
        {canWrite ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-3.5" aria-hidden />
            Add policy
          </Button>
        ) : (
          <p className="text-xs text-[color:var(--ink-muted)]">{viewOnly}</p>
        )}
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {statusMsg ? <StatusLine tone="ok">{statusMsg}</StatusLine> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <AppSelectNative
          label="Category"
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter((e.target.value || "") as "" | PolicyCategory)
          }
        >
          <option value="">All categories</option>
          {POLICY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {POLICY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </AppSelectNative>
        <AppSelectNative
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target.value || "") as "" | PolicyStatus)}
        >
          <option value="">All statuses</option>
          {POLICY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {POLICY_STATUS_LABELS[s]}
            </option>
          ))}
        </AppSelectNative>
        <AppField
          label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, owner, notes…"
        />
      </div>

      {!error && policies.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          body={emptyHelp}
          action={
            canWrite ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-3.5" aria-hidden />
                Add policy
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!error && policies.length > 0 && filtered.length === 0 ? (
        <EmptyState
          title="No matching policies"
          body="Widen the category or status filter, or clear the search."
        />
      ) : null}

      {filtered.length > 0 ? (
        <div className="overflow-x-auto border-t border-[color:var(--rule)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--rule)] text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                <th className="px-2 py-2 font-medium">Title</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Version</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Owner</th>
                <th className="px-2 py-2 font-medium">Effective</th>
                <th className="px-2 py-2 font-medium">Document</th>
                <th className="px-2 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[color:var(--rule)] text-[color:var(--ink)]"
                >
                  <td className="px-2 py-2 font-medium">{p.title}</td>
                  <td className="px-2 py-2 text-[color:var(--ink-muted)]">
                    {POLICY_CATEGORY_LABELS[p.category]}
                  </td>
                  <td className="px-2 py-2">
                    <Mono>{p.version}</Mono>
                  </td>
                  <td className={cn("px-2 py-2", statusClass(p.status))}>
                    {POLICY_STATUS_LABELS[p.status]}
                  </td>
                  <td className="px-2 py-2 text-[color:var(--ink-muted)]">{p.owner}</td>
                  <td className="px-2 py-2">
                    <Mono>{p.effectiveDate || "—"}</Mono>
                  </td>
                  <td className="px-2 py-2">
                    {p.documentUrl ? (
                      <a
                        href={p.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[color:var(--accent)] hover:text-[color:var(--accent-hover)]"
                      >
                        Link
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : p.documentId ? (
                      <span className="text-[color:var(--ink-muted)]">Media</span>
                    ) : (
                      <span className="text-[color:var(--ink-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1">
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                          aria-label={`Edit ${p.title}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => void removePolicy(p.id)}
                          className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--rust)]"
                          aria-label={`Delete ${p.title}`}
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
      ) : null}

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[color:var(--rule-strong)] bg-[color:var(--surface-1)] p-4 shadow-lg">
            <h2
              id="policy-form-title"
              className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
            >
              {editingId ? "Edit policy" : "Add policy"}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              Registry only — paste a document URL. No AI drafting.
            </p>

            <div className="mt-4 grid gap-3">
              <AppField
                label="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <AppSelectNative
                  label="Category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as PolicyCategory,
                    }))
                  }
                >
                  {POLICY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {POLICY_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </AppSelectNative>
                <AppSelectNative
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as PolicyStatus,
                    }))
                  }
                >
                  {POLICY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {POLICY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </AppSelectNative>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AppField
                  label="Version"
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  required
                />
                <AppField
                  label="Effective date"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, effectiveDate: e.target.value }))
                  }
                  required
                />
              </div>
              <AppField
                label="Owner"
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                placeholder="Name or email"
                required
              />
              <AppField
                label="Document URL"
                type="url"
                value={form.documentUrl}
                onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))}
                placeholder="https://…"
              />
              <label className="flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]">
                <span className="label-caps">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-muted)] focus-visible:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]"
                />
              </label>
            </div>

            {formError ? (
              <p className="mt-3 text-sm text-[color:var(--rust)]">{formError}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2 border-t border-[color:var(--rule)] pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void submitForm()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
