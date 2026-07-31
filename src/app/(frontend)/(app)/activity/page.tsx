"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { ActivityItem } from "@/lib/activity";
import { shortRelativeTime } from "@/lib/ui/displayLabels";

type Teammate = { id: string; email: string; name: string };

type LoadResult =
  | { kind: "ok"; activities: ActivityItem[]; total: number; hasMore: boolean }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type Filters = {
  userId: string;
  type: string;
  resourceType: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_LIMIT = 50;
const POLL_MS = 30_000;

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "All resources" },
  { value: "datapoints", label: "Datapoints" },
  { value: "reports", label: "Reports" },
  { value: "suppliers", label: "Suppliers" },
  { value: "evidence", label: "Evidence" },
  { value: "internal-data-requests", label: "Internal requests" },
  { value: "materiality-assessments", label: "Materiality" },
  { value: "compliance-assessment", label: "Compliance" },
  { value: "organisations", label: "Organisations" },
  { value: "accounting-connections", label: "Accounting" },
  { value: "iot-devices", label: "IoT devices" },
] as const;

const ACTION_TYPE_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "datapoint_created", label: "Datapoint created" },
  { value: "datapoint_updated", label: "Datapoint updated" },
  { value: "datapoint_approved", label: "Datapoint approved" },
  { value: "datapoint_rejected", label: "Datapoint rejected" },
  { value: "datapoint_deleted", label: "Datapoint deleted" },
  { value: "report_created", label: "Report created" },
  { value: "report_publish", label: "Report published" },
  { value: "supplier_submit", label: "Supplier submitted" },
  { value: "compliance_assessment_create", label: "Assessment created" },
  { value: "internal_request_create", label: "Request created" },
] as const;

const emptyFilters: Filters = {
  userId: "",
  type: "",
  resourceType: "",
  dateFrom: "",
  dateTo: "",
};

function buildQuery(filters: Filters, offset: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(DEFAULT_LIMIT));
  params.set("offset", String(offset));
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.type) params.set("type", filters.type);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", `${filters.dateTo}T23:59:59.999Z`);
  return params.toString();
}

async function fetchFeed(filters: Filters, offset: number): Promise<LoadResult> {
  const res = await fetch(`/api/app/activity-feed?${buildQuery(filters, offset)}`);
  if (res.status === 403) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      kind: "forbidden",
      message: data.error ?? "Organisation membership required.",
    };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      kind: "error",
      message: data.error ?? "Could not load activity feed",
    };
  }
  const data = (await res.json()) as {
    activities: ActivityItem[];
    total: number;
    pagination?: { hasMore?: boolean };
  };
  return {
    kind: "ok",
    activities: data.activities ?? [],
    total: data.total ?? 0,
    hasMore: Boolean(data.pagination?.hasMore),
  };
}

function fieldClassName(): string {
  return "mt-1 w-full appearance-none rounded-md border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink";
}

function labelClassName(): string {
  return "text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted";
}

export default function ActivityPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const newestIdRef = useRef<string | null>(null);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app/teammates")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { teammates?: Teammate[] };
        if (!cancelled) setTeammates(data.teammates ?? []);
      })
      .catch(() => {
        /* filter still usable without names */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyResult = useCallback((result: LoadResult, mode: "replace" | "append") => {
    if (result.kind === "forbidden") {
      setForbidden(true);
      setError(result.message);
      setActivities([]);
      setTotal(0);
      setHasMore(false);
      return;
    }
    if (result.kind === "error") {
      setForbidden(false);
      setError(result.message);
      return;
    }
    setForbidden(false);
    setError(null);
    setTotal(result.total);
    setHasMore(result.hasMore);
    if (mode === "replace") {
      setActivities(result.activities);
      newestIdRef.current = result.activities[0]?.id ?? null;
      setNewCount(0);
    } else {
      setActivities((prev) => [...prev, ...result.activities]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetchFeed(filters, 0).then((result) => {
        if (cancelled) return;
        applyResult(result, "replace");
        setOffset(0);
        setLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters, applyResult]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        const result = await fetchFeed(filtersRef.current, 0);
        if (result.kind !== "ok" || result.activities.length === 0) return;
        const latest = result.activities[0]?.id ?? null;
        const known = newestIdRef.current;
        if (known && latest && latest !== known) {
          let count = 0;
          for (const row of result.activities) {
            if (row.id === known) break;
            count += 1;
          }
          setNewCount(count > 0 ? count : result.activities.length);
        } else if (!known && latest) {
          newestIdRef.current = latest;
        }
      })();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const loadNewer = () => {
    setLoading(true);
    void fetchFeed(filters, 0).then((result) => {
      applyResult(result, "replace");
      setOffset(0);
      setLoading(false);
    });
  };

  const loadMore = () => {
    const next = offset + DEFAULT_LIMIT;
    setLoadingMore(true);
    void fetchFeed(filters, next).then((result) => {
      applyResult(result, "append");
      if (result.kind === "ok") setOffset(next);
      setLoadingMore(false);
    });
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/app/activity-feed/export?${buildQuery(filters, 0)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-feed-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError("Export failed. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Governance"
      title="Activity"
      help="Who changed what, when — across your organisation. Updates every 30 seconds."
      actions={
        !forbidden ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exporting || loading}
            onClick={() => {
              void onExport();
            }}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        ) : null
      }
      rail={
        <div>
          <p className={labelClassName()}>Live</p>
          <p className="mt-2 text-[13px] text-ink-muted">
            Polling every <span className="font-data text-ink">30</span>s. Admin audit
            remains at{" "}
            <a href="/audit" className="text-accent underline-offset-2 hover:underline">
              /audit
            </a>
            .
          </p>
        </div>
      }
    >
      {forbidden ? (
        <EmptyState
          title="Organisation required"
          body={error ?? "Finish onboarding or switch to an organisation you belong to."}
        />
      ) : (
        <div className="space-y-4">
          {newCount > 0 ? (
            <button
              type="button"
              onClick={loadNewer}
              className="w-full rounded-md border border-accent bg-accent-quiet px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-surface-2"
            >
              <span className="font-medium text-accent">New activities</span>
              <span className="ml-2 font-data text-ink-muted">{newCount}</span>
              <span className="ml-2 text-ink-muted">— show latest</span>
            </button>
          ) : null}

          <PageCard title="Filters">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-[13px]">
                <span className={labelClassName()}>User</span>
                <select
                  className={fieldClassName()}
                  value={draft.userId}
                  onChange={(e) => setDraft((d) => ({ ...d, userId: e.target.value }))}
                >
                  <option value="">All users</option>
                  {teammates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.email || t.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[13px]">
                <span className={labelClassName()}>Action</span>
                <select
                  className={fieldClassName()}
                  value={draft.type}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[13px]">
                <span className={labelClassName()}>Resource type</span>
                <select
                  className={fieldClassName()}
                  value={draft.resourceType}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, resourceType: e.target.value }))
                  }
                >
                  {RESOURCE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[13px]">
                <span className={labelClassName()}>From</span>
                <input
                  type="date"
                  className={`${fieldClassName()} font-data`}
                  value={draft.dateFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                />
              </label>

              <label className="block text-[13px]">
                <span className={labelClassName()}>To</span>
                <input
                  type="date"
                  className={`${fieldClassName()} font-data`}
                  value={draft.dateTo}
                  onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  setFilters({ ...draft });
                }}
              >
                Apply filters
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft(emptyFilters);
                  setLoading(true);
                  setFilters(emptyFilters);
                }}
              >
                Clear
              </Button>
            </div>
            {error && !forbidden ? (
              <div className="mt-3">
                <StatusLine tone="error">{error}</StatusLine>
              </div>
            ) : null}
          </PageCard>

          {loading ? <PageSkeleton /> : null}

          {!loading ? (
            <PageCard title="Feed">
              <p className="mb-3 font-data text-[11px] text-ink-muted">{total} total</p>
              {activities.length === 0 && !error ? (
                <p className="py-6 text-[13px] text-ink-muted">
                  No matching activity. Approvals, publishes, and datapoint edits write
                  here.
                </p>
              ) : (
                <ul>
                  {activities.map((row) => (
                    <li
                      key={row.id}
                      className="border-b border-rule py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <p
                        className="font-data text-[11px] text-ink-muted"
                        title={new Date(row.createdAt).toISOString()}
                      >
                        {shortRelativeTime(row.createdAt)}
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium text-ink">
                        {row.displayName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        <span>{row.actorName}</span>
                        <span className="mx-1.5 text-rule-strong">·</span>
                        <span>{row.resourceTypeLabel}</span>
                        <span className="mx-1.5 text-rule-strong">·</span>
                        <span className="font-data">{row.activityType}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {hasMore ? (
                <div className="mt-4 border-t border-rule pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </PageCard>
          ) : null}
        </div>
      )}
    </PageFrame>
  );
}
