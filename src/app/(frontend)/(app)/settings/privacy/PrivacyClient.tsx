"use client";

import { useCallback, useEffect, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DsrType = "access" | "erasure" | "correction";
type DsrStatus = "open" | "in_progress" | "fulfilled" | "rejected";

type DsrRow = {
  id: string;
  type: DsrType;
  requesterEmail: string;
  status: DsrStatus;
  notes: string | null;
  dueAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
};

type RetentionState = {
  dpdEnabled: boolean;
  retentionDays: { datapoints: number | null; evidence: number | null };
};

const DSR_TYPE_LABEL: Record<DsrType, string> = {
  access: "Access",
  erasure: "Erasure",
  correction: "Correction",
};

const DSR_STATUS_LABEL: Record<DsrStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
};

function statusTone(status: DsrStatus): string {
  switch (status) {
    case "fulfilled":
      return "text-signal";
    case "rejected":
      return "text-rust";
    case "in_progress":
      return "text-amber";
    case "open":
      return "text-ink-muted";
  }
}

function emptyForm(): {
  type: DsrType;
  requesterEmail: string;
  notes: string;
  dueAt: string;
} {
  return { type: "access", requesterEmail: "", notes: "", dueAt: "" };
}

export function PrivacyClient({ canEdit }: { canEdit: boolean }) {
  const [requests, setRequests] = useState<DsrRow[]>([]);
  const [canFulfill, setCanFulfill] = useState(false);
  const [retentionDraft, setRetentionDraft] = useState<RetentionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingRetention, setSavingRetention] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dsrRes, retentionRes] = await Promise.all([
        fetch("/api/app/privacy/dsr"),
        fetch("/api/app/privacy/retention"),
      ]);
      if (dsrRes.ok) {
        const data = (await dsrRes.json()) as { requests: DsrRow[]; canFulfill: boolean };
        setRequests(data.requests);
        setCanFulfill(data.canFulfill);
      } else {
        const data = (await dsrRes.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not load data subject requests");
      }
      if (retentionRes.ok) {
        const data = (await retentionRes.json()) as RetentionState;
        setRetentionDraft(data);
      }
    } catch {
      setError("Could not reach the privacy API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createRequest() {
    if (!form.requesterEmail.trim()) {
      setError("Requester email is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/app/privacy/dsr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          requesterEmail: form.requesterEmail.trim(),
          notes: form.notes.trim() || undefined,
          dueAt: form.dueAt || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not log request");
        return;
      }
      setStatus("Request logged.");
      setForm(emptyForm());
      setFormOpen(false);
      await load();
    } catch {
      setError("Could not log request");
    } finally {
      setSaving(false);
    }
  }

  async function setDsrStatus(row: DsrRow, next: DsrStatus) {
    setBusyId(row.id);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/app/privacy/dsr/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update request");
        return;
      }
      setStatus(
        next === "fulfilled"
          ? "Request marked fulfilled."
          : next === "rejected"
            ? "Request rejected."
            : "Request updated.",
      );
      await load();
    } catch {
      setError("Could not update request");
    } finally {
      setBusyId(null);
    }
  }

  async function saveRetention() {
    if (!retentionDraft || !canEdit) return;
    setSavingRetention(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/app/privacy/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retentionDraft),
      });
      const data = (await res.json().catch(() => ({}))) as
        (RetentionState & { ok: true }) | { error?: string };
      if (!res.ok) {
        setError(
          "error" in data
            ? (data.error ?? "Could not save retention policy")
            : "Could not save retention policy",
        );
        return;
      }
      if ("dpdEnabled" in data) {
        setRetentionDraft({
          dpdEnabled: data.dpdEnabled,
          retentionDays: data.retentionDays,
        });
      }
      setStatus("Retention policy saved.");
    } catch {
      setError("Could not save retention policy");
    } finally {
      setSavingRetention(false);
    }
  }

  if (loading) {
    return <PageSkeleton rows={5} />;
  }

  return (
    <div className="space-y-8">
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}

      <PageCard title="Data subject requests" className="space-y-4">
        <p className="text-[13px] text-ink-muted">
          Log and track access, erasure, and correction requests from data principals.
          Marking a request fulfilled or rejected requires an owner or admin.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-ink-muted">
            <span className="font-data text-ink">{requests.length}</span> request
            {requests.length === 1 ? "" : "s"} logged
          </p>
          <Button type="button" size="sm" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? "Cancel" : "Log a request"}
          </Button>
        </div>

        {formOpen ? (
          <div className="space-y-3 border-t border-rule pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <AppSelectNative
                label="Request type"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as DsrType }))
                }
                disabled={saving}
              >
                {(Object.keys(DSR_TYPE_LABEL) as DsrType[]).map((t) => (
                  <option key={t} value={t}>
                    {DSR_TYPE_LABEL[t]}
                  </option>
                ))}
              </AppSelectNative>
              <AppField
                label="Requester email"
                type="email"
                value={form.requesterEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requesterEmail: e.target.value }))
                }
                disabled={saving}
                required
              />
              <AppField
                label="Due date"
                type="date"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                disabled={saving}
              />
            </div>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              <span className="label-caps">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={saving}
                rows={2}
                className="w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void createRequest()}
            >
              {saving ? "Saving…" : "Log request"}
            </Button>
          </div>
        ) : null}

        {requests.length === 0 ? (
          <EmptyState
            title="No requests logged"
            body="When a data principal asks to access, correct, or erase their data, log it here to track the SLA."
          />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {requests.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-data text-sm text-ink">
                      {row.requesterEmail}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      {DSR_TYPE_LABEL[row.type]}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.08em]",
                        statusTone(row.status),
                      )}
                    >
                      {DSR_STATUS_LABEL[row.status]}
                    </span>
                  </div>
                  {row.notes ? (
                    <p className="mt-1 text-[13px] text-ink-muted">{row.notes}</p>
                  ) : null}
                  <p className="mt-1 font-data text-[11px] text-ink-muted">
                    {row.dueAt
                      ? `Due ${new Date(row.dueAt).toLocaleDateString()}`
                      : "No due date"}
                    {row.fulfilledAt
                      ? ` · fulfilled ${new Date(row.fulfilledAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {canFulfill && row.status !== "fulfilled" && row.status !== "rejected" ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {row.status === "open" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => void setDsrStatus(row, "in_progress")}
                      >
                        Start
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void setDsrStatus(row, "fulfilled")}
                    >
                      Mark fulfilled
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void setDsrStatus(row, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PageCard>

      <PageCard title="Retention policy" className="space-y-4">
        <p className="text-[13px] text-ink-muted">
          DPDP Act product beachhead — hosting region / Atlas selection is an open
          decision (§11). Setting a retention window here does not automatically delete
          data: the retention purge job only runs in dry-run mode until ops explicitly
          enables it.
        </p>

        {retentionDraft ? (
          <>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={retentionDraft.dpdEnabled}
                disabled={!canEdit || savingRetention}
                onChange={(e) =>
                  setRetentionDraft((prev) =>
                    prev ? { ...prev, dpdEnabled: e.target.checked } : prev,
                  )
                }
                className="size-4"
              />
              DPDP workflows enabled for this organisation
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <AppField
                label="Datapoint retention (days, blank = indefinite)"
                type="number"
                min={0}
                value={retentionDraft.retentionDays.datapoints ?? ""}
                disabled={!canEdit || savingRetention}
                onChange={(e) =>
                  setRetentionDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          retentionDays: {
                            ...prev.retentionDays,
                            datapoints:
                              e.target.value === "" ? null : Number(e.target.value),
                          },
                        }
                      : prev,
                  )
                }
              />
              <AppField
                label="Evidence retention (days, blank = indefinite)"
                type="number"
                min={0}
                value={retentionDraft.retentionDays.evidence ?? ""}
                disabled={!canEdit || savingRetention}
                onChange={(e) =>
                  setRetentionDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          retentionDays: {
                            ...prev.retentionDays,
                            evidence:
                              e.target.value === "" ? null : Number(e.target.value),
                          },
                        }
                      : prev,
                  )
                }
              />
            </div>

            {canEdit ? (
              <Button
                type="button"
                size="sm"
                disabled={savingRetention}
                onClick={() => void saveRetention()}
              >
                {savingRetention ? "Saving…" : "Save retention policy"}
              </Button>
            ) : (
              <p className="text-[13px] text-ink-muted">
                View only — ask an owner or admin.
              </p>
            )}
          </>
        ) : null}
      </PageCard>
    </div>
  );
}
