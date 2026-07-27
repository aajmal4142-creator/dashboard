"use client";

import { useEffect, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { auditActionLabel, shortRelativeTime } from "@/lib/ui/displayLabels";

type LogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { email: string } | null;
};

type LoadResult =
  | { kind: "ok"; logs: LogRow[] }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "datapoints", label: "Datapoints" },
  { value: "reports", label: "Reports" },
  { value: "internal-data-requests", label: "Internal requests" },
  { value: "evidence", label: "Evidence" },
  { value: "materiality-assessments", label: "Materiality" },
  { value: "organisations", label: "Organisations" },
] as const;

async function fetchAuditLogs(entityType: string): Promise<LoadResult> {
  const q = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
  const res = await fetch(`/api/app/audit-logs${q}`);
  if (res.status === 403) {
    return { kind: "forbidden" };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { kind: "error", message: data.error ?? "Could not load audit log" };
  }
  const data = (await res.json()) as { logs: LogRow[] };
  return { kind: "ok", logs: data.logs };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [entityType, setEntityType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void fetchAuditLogs(entityType).then((result) => {
      if (cancelled) return;
      if (result.kind === "forbidden") {
        setForbidden(true);
        setError(null);
        setLogs([]);
      } else if (result.kind === "error") {
        setError(result.message);
        setForbidden(false);
      } else {
        setLogs(result.logs);
        setError(null);
        setForbidden(false);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [entityType, reloadKey]);

  const exportHref = "/api/app/export";

  return (
    <PageFrame
      eyebrow="Governance"
      title="Immutable change log"
      help="Who changed what, when. Append-only. Visible to admin and owner."
      rail={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Export
          </p>
          {!forbidden ? (
            <a
              href={exportHref}
              className="mt-2 inline-block text-[13px] font-medium text-accent underline-offset-2 hover:underline"
            >
              Full-account export
            </a>
          ) : (
            <p className="mt-2 text-[13px] text-ink-muted">
              Export requires admin access.
            </p>
          )}
        </div>
      }
    >
      {forbidden ? (
        <EmptyState
          title="Admin access required"
          body="The audit log is available to organisation admins and owners. Ask an admin if you need a change history for assurance."
        />
      ) : (
        <div className="space-y-4">
          <PageCard title="Filter">
            <label className="block text-[13px]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Entity type
              </span>
              <select
                className="mt-1 w-full appearance-none rounded-md border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink"
                value={entityType}
                onChange={(e) => {
                  setLoading(true);
                  setEntityType(e.target.value);
                }}
              >
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? <StatusLine tone="error">{error}</StatusLine> : null}
          </PageCard>

          {loading ? <PageSkeleton /> : null}

          {!loading ? (
            <PageCard title="Events">
              <ul>
                {logs.map((l) => (
                  <li
                    key={l.id}
                    className="border-b border-rule py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <p
                      className="font-data text-[11px] text-ink-muted"
                      title={new Date(l.createdAt).toISOString()}
                    >
                      {shortRelativeTime(l.createdAt)}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-ink">
                      {auditActionLabel(l.action)} · {l.entityType}/{l.entityId}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {l.actor?.email ?? "system"}
                    </p>
                  </li>
                ))}
                {logs.length === 0 && !error ? (
                  <li className="py-6 text-[13px] text-ink-muted">
                    {entityType
                      ? "No matching events"
                      : "No audit events yet. Approvals, publishes, and assignments write here."}
                  </li>
                ) : null}
              </ul>
            </PageCard>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
          >
            Refresh
          </Button>
        </div>
      )}
    </PageFrame>
  );
}
