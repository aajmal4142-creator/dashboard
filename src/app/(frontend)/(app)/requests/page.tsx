"use client";

import { useEffect, useMemo, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative, appFieldClass } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { slaLabel, type SlaTone } from "@/lib/internal-requests";
import { requestStatusLabel, reviewStatusLabel } from "@/lib/ui/displayLabels";
import { cn } from "@/lib/utils";

type RequestRow = {
  id: string;
  title: string;
  requestStatus: string;
  reviewStatus: string;
  dueAt?: string | null;
  dueDate?: string | null;
  escalatedAt?: string | null;
  metricKeys: string[];
  evidenceIds: string[];
  sla: SlaTone;
  assignee: { id: string; email: string; name?: string } | null;
  reviewerNotes?: string | null;
};

type Teammate = { id: string; email: string; name: string };

type MetricValueDraft = { metricKey: string; value: string; unit: string };

const SLA_FILTERS = [
  { value: "", label: "All SLA" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due soon" },
  { value: "escalated", label: "Escalated" },
] as const;

function slaBadgeClass(tone: SlaTone): string {
  switch (tone) {
    case "escalated":
      return "border-rust/50 bg-rust/10 text-rust";
    case "overdue":
      return "border-rust/40 text-rust";
    case "due_soon":
      return "border-amber/50 bg-amber/10 text-amber";
    case "ok":
      return "border-signal/40 text-signal";
    default:
      return "border-rule text-ink-muted";
  }
}

async function fetchRequests(filters: {
  sla: string;
  requestStatus: string;
  reviewStatus: string;
  q: string;
}): Promise<{
  rows: RequestRow[];
  teammates: Teammate[];
  error: string | null;
}> {
  const params = new URLSearchParams();
  if (filters.sla) params.set("sla", filters.sla);
  if (filters.requestStatus) params.set("requestStatus", filters.requestStatus);
  if (filters.reviewStatus) params.set("reviewStatus", filters.reviewStatus);
  if (filters.q.trim()) params.set("q", filters.q.trim());

  const qs = params.toString();
  const [reqRes, teamRes] = await Promise.all([
    fetch(`/api/app/internal-requests${qs ? `?${qs}` : ""}`),
    fetch("/api/app/teammates"),
  ]);

  if (!reqRes.ok) {
    const data = (await reqRes.json().catch(() => ({}))) as { error?: string };
    return {
      rows: [],
      teammates: [],
      error:
        data.error ??
        "Could not load requests. Finish onboarding or switch organisation.",
    };
  }

  const data = (await reqRes.json()) as { requests: RequestRow[] };
  let teammates: Teammate[] = [];
  if (teamRes.ok) {
    const t = (await teamRes.json()) as { teammates: Teammate[] };
    teammates = t.teammates ?? [];
  }

  return { rows: data.requests, teammates, error: null };
}

export default function RequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [title, setTitle] = useState("Q1 energy pack");
  const [assigneeId, setAssigneeId] = useState("");
  const [metricKeys, setMetricKeys] = useState("electricity_kwh,diesel_litres");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filterSla, setFilterSla] = useState("");
  const [filterRequestStatus, setFilterRequestStatus] = useState("");
  const [filterReviewStatus, setFilterReviewStatus] = useState("");
  const [filterQ, setFilterQ] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequestRow | null>(null);
  const [detailEvidence, setDetailEvidence] = useState<
    Array<{ id: string; filename: string | null }>
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [valueDrafts, setValueDrafts] = useState<MetricValueDraft[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchRequests({
      sla: filterSla,
      requestStatus: filterRequestStatus,
      reviewStatus: filterReviewStatus,
      q: filterQ,
    }).then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setTeammates(result.teammates);
      setLoadError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, filterSla, filterRequestStatus, filterReviewStatus, filterQ]);

  useEffect(() => {
    if (!selectedId) {
      const clearId = window.setTimeout(() => {
        setDetail(null);
        setDetailEvidence([]);
        setValueDrafts([]);
      }, 0);
      return () => window.clearTimeout(clearId);
    }
    let cancelled = false;
    const loadId = window.setTimeout(() => {
      if (cancelled) return;
      setDetailLoading(true);
      void fetch(`/api/app/internal-requests/${selectedId}`)
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as {
            request?: RequestRow;
            evidence?: Array<{ id: string; filename: string | null }>;
            error?: string;
          };
          if (cancelled) return;
          if (!res.ok || !data.request) {
            setStatusTone("error");
            setStatus(data.error ?? "Could not load request detail");
            setDetailLoading(false);
            return;
          }
          setDetail(data.request);
          setDetailEvidence(data.evidence ?? []);
          setValueDrafts(
            data.request.metricKeys.map((key) => ({
              metricKey: key,
              value: "",
              unit: "",
            })),
          );
          setDetailLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setStatusTone("error");
          setStatus("Could not load request detail");
          setDetailLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(loadId);
    };
  }, [selectedId, reloadKey]);

  const openCount = useMemo(
    () => rows.filter((r) => r.requestStatus !== "submitted").length,
    [rows],
  );

  function reload() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  async function create() {
    if (!assigneeId) {
      setStatusTone("error");
      setStatus("Choose a teammate.");
      return;
    }
    setStatusTone("neutral");
    setStatus("Sending…");
    const res = await fetch("/api/app/internal-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        assigneeId,
        metricKeys: metricKeys
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        dueAt: dueDate || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Failed");
      return;
    }
    setStatusTone("ok");
    setStatus("Request sent");
    reload();
  }

  async function uploadEvidence(file: File) {
    if (!detail) return;
    setUploading(true);
    setStatusTone("neutral");
    setStatus("Uploading evidence…");
    const form = new FormData();
    form.set("file", file);
    form.set("metricKey", detail.metricKeys[0] ?? "pack");
    form.set("whyNote", `Evidence for internal request ${detail.title}`);
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
    };
    setUploading(false);
    if (!res.ok || !data.id) {
      setStatusTone("error");
      setStatus(data.error ?? "Evidence upload failed");
      return;
    }
    setDetailEvidence((prev) => [...prev, { id: data.id!, filename: file.name }]);
    setStatusTone("ok");
    setStatus("Evidence attached (include on submit)");
  }

  async function submitPack() {
    if (!detail) return;
    const values = valueDrafts
      .map((d) => ({
        metricKey: d.metricKey,
        value: Number(d.value),
        unit: d.unit || undefined,
        quality: "measured" as const,
      }))
      .filter((v) => Number.isFinite(v.value));

    if (values.length === 0) {
      setStatusTone("error");
      setStatus("Enter at least one numeric value for the pack.");
      return;
    }

    setStatusTone("neutral");
    setStatus("Submitting…");
    const res = await fetch("/api/app/internal-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: detail.id,
        values,
        evidenceIds: detailEvidence.map((e) => e.id),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Submit failed");
      return;
    }
    setStatusTone("ok");
    setStatus("Submitted for approval");
    reload();
  }

  async function review(decision: "approved" | "rejected") {
    if (!detail) return;
    if (decision === "rejected" && !reviewNotes.trim()) {
      setStatusTone("error");
      setStatus("Reviewer notes required when rejecting.");
      return;
    }
    setStatusTone("neutral");
    setStatus(decision === "approved" ? "Approving…" : "Rejecting…");
    const res = await fetch(`/api/app/internal-requests/${detail.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        reviewerNotes: reviewNotes.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Review failed");
      return;
    }
    setStatusTone("ok");
    setStatus(decision === "approved" ? "Approved" : "Rejected");
    setReviewNotes("");
    reload();
  }

  async function escalateSelected() {
    if (!detail) return;
    setStatusTone("neutral");
    setStatus("Escalating…");
    const res = await fetch(`/api/app/internal-requests/${detail.id}/escalate`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Escalate failed");
      return;
    }
    setStatusTone("ok");
    setStatus("Escalated");
    reload();
  }

  return (
    <PageFrame
      eyebrow="Requests"
      title="Internal data requests"
      help="Assign a multi-metric pack with a due date. Assignees attach evidence and submit; admins approve or reject. Overdue packs escalate automatically."
      rail={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Open
          </p>
          <p className="mt-2 font-data text-[28px] font-bold text-ink">{openCount}</p>
          <p className="mt-1 text-[11px] text-ink-muted">{rows.length} listed</p>
        </div>
      }
    >
      {loading ? <PageSkeleton /> : null}
      {loadError ? <EmptyState title="Requests unavailable" body={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="space-y-4">
          <PageCard title="New pack request">
            <div className="grid gap-3 md:grid-cols-2">
              <AppField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q1 energy pack"
              />
              <AppSelectNative
                label="Assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Select teammate</option>
                {teammates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.email || t.id}
                  </option>
                ))}
              </AppSelectNative>
              {teammates.length === 0 ? (
                <p className="text-[12px] text-ink-muted md:col-span-2">
                  No teammates found. Invite members before assigning requests.
                </p>
              ) : null}
              <AppField
                label="Metrics (comma-separated pack)"
                className="font-data"
                value={metricKeys}
                onChange={(e) => setMetricKeys(e.target.value)}
                placeholder="e.g. electricity_kwh, diesel_litres"
              />
              <AppField
                type="date"
                label="Due date (SLA)"
                className="font-data"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="md:col-span-2">
                <Button type="button" size="sm" onClick={() => void create()}>
                  Send pack request
                </Button>
                {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}
              </div>
            </div>
          </PageCard>

          <PageCard title="Filters">
            <div className="grid gap-3 md:grid-cols-4">
              <AppField
                label="Search title"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="Energy…"
              />
              <AppSelectNative
                label="SLA"
                value={filterSla}
                onChange={(e) => setFilterSla(e.target.value)}
              >
                {SLA_FILTERS.map((f) => (
                  <option key={f.value || "all"} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </AppSelectNative>
              <AppSelectNative
                label="Collection status"
                value={filterRequestStatus}
                onChange={(e) => setFilterRequestStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="not_sent">{requestStatusLabel("not_sent")}</option>
                <option value="sent">{requestStatusLabel("sent")}</option>
                <option value="opened">{requestStatusLabel("opened")}</option>
                <option value="submitted">{requestStatusLabel("submitted")}</option>
              </AppSelectNative>
              <AppSelectNative
                label="Review status"
                value={filterReviewStatus}
                onChange={(e) => setFilterReviewStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="pending">{reviewStatusLabel("pending")}</option>
                <option value="submitted">{reviewStatusLabel("submitted")}</option>
                <option value="approved">{reviewStatusLabel("approved")}</option>
                <option value="rejected">{reviewStatusLabel("rejected")}</option>
              </AppSelectNative>
            </div>
          </PageCard>

          {rows.length === 0 ? (
            <EmptyState
              title="No internal requests yet"
              body="Create a multi-metric pack to assign energy or social metrics to a teammate with a due date."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <PageCard title="Requests">
                <ul>
                  {rows.map((r) => (
                    <li key={r.id} className="border-b border-rule last:border-b-0">
                      <button
                        type="button"
                        className={cn(
                          "w-full px-1 py-3 text-left transition-colors hover:bg-surface-2",
                          selectedId === r.id && "bg-surface-2",
                        )}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-ink">{r.title}</p>
                            <p className="mt-0.5 font-data text-[11px] text-ink-muted">
                              {requestStatusLabel(r.requestStatus)}
                              {" · "}
                              {reviewStatusLabel(r.reviewStatus)}
                              {r.dueAt ? ` · due ${String(r.dueAt).slice(0, 10)}` : ""}
                              {" · "}
                              {r.metricKeys.join(", ")}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                              slaBadgeClass(r.sla),
                            )}
                          >
                            {slaLabel(r.sla)}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </PageCard>

              <PageCard title="Detail">
                {!selectedId ? (
                  <p className="text-[13px] text-ink-muted">
                    Select a request to submit values, attach evidence, or review.
                  </p>
                ) : detailLoading ? (
                  <PageSkeleton />
                ) : !detail ? (
                  <EmptyState
                    title="Request unavailable"
                    body="Could not load this request. Refresh and try again."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                          slaBadgeClass(detail.sla),
                        )}
                      >
                        {slaLabel(detail.sla)}
                      </span>
                      <span className="font-data text-[11px] text-ink-muted">
                        {requestStatusLabel(detail.requestStatus)} ·{" "}
                        {reviewStatusLabel(detail.reviewStatus)}
                      </span>
                    </div>

                    <p className="text-[13px] text-ink">
                      Pack:{" "}
                      <span className="font-data">{detail.metricKeys.join(", ")}</span>
                    </p>
                    {detail.assignee ? (
                      <p className="text-[12px] text-ink-muted">
                        Assignee: {detail.assignee.name || detail.assignee.email}
                      </p>
                    ) : null}

                    {detail.requestStatus !== "submitted" ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                            Values
                          </p>
                          {valueDrafts.map((d, i) => (
                            <div
                              key={d.metricKey}
                              className="grid gap-2 md:grid-cols-[1fr_120px_100px]"
                            >
                              <p className="font-data text-[12px] text-ink self-center">
                                {d.metricKey}
                              </p>
                              <input
                                className={cn(appFieldClass, "font-data")}
                                inputMode="decimal"
                                placeholder="Value"
                                value={d.value}
                                aria-label={`Value for ${d.metricKey}`}
                                onChange={(e) => {
                                  const next = [...valueDrafts];
                                  next[i] = { ...d, value: e.target.value };
                                  setValueDrafts(next);
                                }}
                              />
                              <input
                                className={cn(appFieldClass, "font-data")}
                                placeholder="Unit"
                                value={d.unit}
                                aria-label={`Unit for ${d.metricKey}`}
                                onChange={(e) => {
                                  const next = [...valueDrafts];
                                  next[i] = { ...d, unit: e.target.value };
                                  setValueDrafts(next);
                                }}
                              />
                            </div>
                          ))}
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                            Evidence
                          </p>
                          {detailEvidence.length === 0 ? (
                            <p className="mb-2 text-[12px] text-ink-muted">
                              No evidence attached yet.
                            </p>
                          ) : (
                            <ul className="mb-2 space-y-1">
                              {detailEvidence.map((e) => (
                                <li
                                  key={e.id}
                                  className="font-data text-[11px] text-ink-muted"
                                >
                                  {e.filename ?? e.id}
                                </li>
                              ))}
                            </ul>
                          )}
                          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-accent">
                            <input
                              type="file"
                              className="sr-only"
                              disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadEvidence(file);
                                e.target.value = "";
                              }}
                            />
                            {uploading ? "Uploading…" : "Attach evidence file"}
                          </label>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void submitPack()}
                          >
                            Submit with evidence
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void escalateSelected()}
                          >
                            Escalate
                          </Button>
                        </div>
                      </>
                    ) : null}

                    {detail.reviewStatus === "submitted" ? (
                      <div className="space-y-3 border-t border-rule pt-3">
                        <p className="text-[12px] text-ink-muted">
                          Submitted — approve or reject (does not change datapoint
                          approval state; F13 owns that).
                        </p>
                        {detailEvidence.length > 0 ? (
                          <ul className="space-y-1">
                            {detailEvidence.map((e) => (
                              <li
                                key={e.id}
                                className="font-data text-[11px] text-ink-muted"
                              >
                                Evidence: {e.filename ?? e.id}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <AppField
                          label="Reviewer notes"
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Required when rejecting"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void review("approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void review("rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {detail.reviewStatus === "approved" ||
                    detail.reviewStatus === "rejected" ? (
                      <p className="border-t border-rule pt-3 text-[13px] text-ink-muted">
                        {reviewStatusLabel(detail.reviewStatus)}
                        {detail.reviewerNotes ? ` — ${detail.reviewerNotes}` : ""}
                      </p>
                    ) : null}
                  </div>
                )}
              </PageCard>
            </div>
          )}
        </div>
      ) : null}
    </PageFrame>
  );
}
