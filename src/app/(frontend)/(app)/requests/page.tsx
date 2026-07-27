"use client";

import { useEffect, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative, appFieldClass } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { requestStatusLabel } from "@/lib/ui/displayLabels";
import { cn } from "@/lib/utils";

type RequestRow = {
  id: string;
  title: string;
  requestStatus: string;
  dueDate?: string | null;
  metricKeys: string[];
};

type Teammate = { id: string; email: string; name: string };

async function fetchRequests(): Promise<{
  rows: RequestRow[];
  teammates: Teammate[];
  error: string | null;
}> {
  const [reqRes, teamRes] = await Promise.all([
    fetch("/api/app/internal-requests"),
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

  useEffect(() => {
    let cancelled = false;

    void fetchRequests().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setTeammates(result.teammates);
      setLoadError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
        dueDate: dueDate || undefined,
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

  async function patchStatus(id: string, requestStatus: string) {
    const res = await fetch("/api/app/internal-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, requestStatus }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setStatusTone("error");
      setStatus(data.error ?? "Update failed");
      return;
    }
    reload();
  }

  return (
    <PageFrame
      eyebrow="Requests"
      title="Internal data requests"
      help="Assign a metric checklist to a teammate with a due date. They sign in to respond."
      rail={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Open
          </p>
          <p className="mt-2 font-data text-[28px] font-bold text-ink">{rows.length}</p>
        </div>
      }
    >
      {loading ? <PageSkeleton /> : null}
      {loadError ? <EmptyState title="Requests unavailable" body={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="space-y-4">
          <PageCard title="New request">
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
                label="Metrics"
                className="font-data"
                value={metricKeys}
                onChange={(e) => setMetricKeys(e.target.value)}
                placeholder="e.g. electricity_kwh, diesel_litres"
              />
              <AppField
                type="date"
                label="Due date"
                className="font-data"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="md:col-span-2">
                <Button type="button" size="sm" onClick={() => void create()}>
                  Send request
                </Button>
                {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}
              </div>
            </div>
          </PageCard>

          {rows.length === 0 ? (
            <EmptyState
              title="No internal requests yet"
              body="Create one to assign energy or social metrics to a teammate with a due date."
            />
          ) : (
            <PageCard title="Open requests">
              <ul>
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-rule py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                      <div>
                        <p className="font-medium text-ink">{r.title}</p>
                        <p className="mt-0.5 font-data text-[11px] text-ink-muted">
                          {requestStatusLabel(r.requestStatus)}
                          {r.dueDate ? ` · due ${String(r.dueDate).slice(0, 10)}` : ""}
                          {" · "}
                          {r.metricKeys.join(", ")}
                        </p>
                      </div>
                      <select
                        className={cn(
                          appFieldClass,
                          "w-auto appearance-none px-2 py-1 text-[11px]",
                        )}
                        value={r.requestStatus}
                        onChange={(e) => void patchStatus(r.id, e.target.value)}
                        aria-label={`Status for ${r.title}`}
                      >
                        <option value="not_sent">{requestStatusLabel("not_sent")}</option>
                        <option value="sent">{requestStatusLabel("sent")}</option>
                        <option value="opened">{requestStatusLabel("opened")}</option>
                        <option value="submitted">
                          {requestStatusLabel("submitted")}
                        </option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </PageCard>
          )}
        </div>
      ) : null}
    </PageFrame>
  );
}
