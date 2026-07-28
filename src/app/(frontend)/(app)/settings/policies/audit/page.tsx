"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageFrame, PageCard } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelectNative } from "@/components/ui/AppField";
import { toast } from "sonner";
import type { AuditLogEntry } from "@/lib/policy/types";

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"];
const RESOURCES = ["datapoint", "report", "supplier", "evidence", "audit", "policies"];
const DECISIONS = ["allowed", "denied"];

interface AuditLog extends AuditLogEntry {
  id: string;
  userName?: string;
  userEmail?: string;
}

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  async function loadAuditLogs() {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        limit: "500",
        offset: "0",
      });

      if (userFilter) params.append("userId", userFilter);
      if (actionFilter) params.append("action", actionFilter);
      if (resourceFilter) params.append("resource", resourceFilter);
      if (decisionFilter) params.append("decision", decisionFilter);

      const res = await fetch(`/api/app/policies/audit-logs?${params}`);

      if (res.status === 403) {
        toast.error("Admin access required");
        router.push("/");
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch audit logs");

      const data = (await res.json()) as { docs?: AuditLog[] };
      let results = data.docs || [];

      if (dateFromFilter) {
        const fromDate = new Date(dateFromFilter);
        results = results.filter((log) => new Date(log.evaluatedAt) >= fromDate);
      }
      if (dateToFilter) {
        const toDate = new Date(dateToFilter);
        toDate.setHours(23, 59, 59, 999);
        results = results.filter((log) => new Date(log.evaluatedAt) <= toDate);
      }

      setLogs(results);
      setCurrentPage(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const res = await fetch("/api/app/policies/audit-logs?limit=500&offset=0");

        if (res.status === 403) {
          toast.error("Admin access required");
          router.push("/");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch audit logs");

        const data = (await res.json()) as { docs?: AuditLog[] };
        if (!cancelled) {
          setLogs(data.docs || []);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load audit logs");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (userFilter) {
      result = result.filter((log) =>
        log.userId.toLowerCase().includes(userFilter.toLowerCase()),
      );
    }

    return result;
  }, [logs, userFilter]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  async function handleExport() {
    try {
      setExporting(true);

      // Build CSV
      const headers = [
        "User ID",
        "Action",
        "Resource",
        "Resource ID",
        "Decision",
        "Reason",
        "User Role",
        "Date",
      ];
      const rows = filteredLogs.map((log) => [
        log.userId,
        log.action,
        log.resource,
        log.resourceId,
        log.decision,
        log.reason,
        log.userRole || "",
        new Date(log.evaluatedAt).toISOString(),
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) =>
              typeof cell === "string" && cell.includes(",")
                ? `"${cell.replace(/"/g, '""')}"`
                : cell,
            )
            .join(","),
        ),
      ].join("\n");

      // Trigger download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Audit log exported");
    } catch {
      toast.error("Failed to export audit log");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <PageFrame eyebrow="Settings" title="Audit Logs">
        <PageCard>
          <div className="py-8 text-center">Loading...</div>
        </PageCard>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      eyebrow="Settings"
      title="Audit Logs"
      help="View and filter policy evaluation events"
      actions={
        <Button onClick={handleExport} disabled={exporting || filteredLogs.length === 0}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      }
    >
      <PageCard>
        {/* Filters */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Input
            type="text"
            placeholder="User ID..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
          <AppSelectNative
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </AppSelectNative>
          <AppSelectNative
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
          >
            <option value="">All Resources</option>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </AppSelectNative>
          <AppSelectNative
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
          >
            <option value="">All Decisions</option>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </AppSelectNative>
          <Input
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            placeholder="From date"
          />
          <Input
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            placeholder="To date"
          />
        </div>

        <div className="mb-4 flex justify-between gap-2">
          <Button variant="outline" onClick={loadAuditLogs} disabled={loading}>
            Apply Filters
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setUserFilter("");
              setActionFilter("");
              setResourceFilter("");
              setDecisionFilter("");
              setDateFromFilter("");
              setDateToFilter("");
            }}
          >
            Clear All
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-rule-strong">
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  User
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Action
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Resource
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Decision
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Reason
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-softer">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-rule-soft transition-colors hover:bg-surface-2 ${
                      log.decision === "denied" ? "bg-rust/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-mono">
                      {log.userId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">{log.resource}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          log.decision === "allowed"
                            ? "bg-signal/20 text-signal"
                            : "bg-rust/20 text-rust"
                        }`}
                      >
                        {log.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-softer">
                      {log.reason.slice(0, 40)}...
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {new Date(log.evaluatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">{log.userRole || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-ink-softer">
              Page {currentPage} of {totalPages} ({filteredLogs.length} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </PageCard>
    </PageFrame>
  );
}
