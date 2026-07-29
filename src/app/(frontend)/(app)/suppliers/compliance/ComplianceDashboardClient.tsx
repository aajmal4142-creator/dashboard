"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download } from "lucide-react";

interface ComplianceIssue {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

interface Supplier {
  id: string;
  name: string;
  category: string;
  annualSpend: number | null;
  responseStatus: "responded" | "pending" | "overdue" | "never_contacted";
  dataCompleteness: number;
  complianceScore: number;
  issueCount: number;
  issues: ComplianceIssue[];
  lastDataUpdate: Date | null;
  respondedAt: Date | null;
  sentAt: Date | null;
  daysSinceContact: number | null;
}

interface Summary {
  totalSuppliers: number;
  responded: number;
  pending: number;
  overdue: number;
  neverContacted: number;
  avgDataCompleteness: number;
  avgComplianceScore: number;
  suppliersWithIssues: number;
}

interface Reminder {
  supplierId: string;
  supplierName: string;
  reminderType: "first" | "friendly" | "urgent";
  reason: string;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "responded":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "overdue":
      return "bg-orange-100 text-orange-800";
    case "never_contacted":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "responded":
      return "Responded";
    case "pending":
      return "Pending";
    case "overdue":
      return "Overdue";
    case "never_contacted":
      return "Never Contacted";
    default:
      return status;
  }
}

export function ComplianceDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState<"compliance" | "issues" | "days">("compliance");

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/app/suppliers/compliance-dashboard");
        if (!response.ok) throw new Error("Failed to load compliance data");
        const data = await response.json();
        setSuppliers(data.suppliers);
        setSummary(data.summary);
        setReminders(data.reminders);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = useMemo(() => {
    let result = [...suppliers];

    if (filterStatus) {
      result = result.filter((s) => s.responseStatus === filterStatus);
    }

    result.sort((a, b) => {
      if (sortBy === "compliance") {
        return b.complianceScore - a.complianceScore;
      } else if (sortBy === "issues") {
        return b.issueCount - a.issueCount;
      } else {
        return (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0);
      }
    });

    return result;
  }, [suppliers, filterStatus, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading compliance data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Monitor supplier engagement and SLA compliance
        </p>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm">Total Suppliers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summary.totalSuppliers}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <p className="text-gray-500 text-sm">Responded</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.responded}</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.totalSuppliers > 0
                ? Math.round((summary.responded / summary.totalSuppliers) * 100)
                : 0}
              %
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <p className="text-gray-500 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.pending}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <p className="text-gray-500 text-sm">Issues</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {summary.suppliersWithIssues}
            </p>
          </div>
        </div>
      )}

      {/* Compliance Metrics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Avg Data Completeness
            </h3>
            <div className="flex items-baseline gap-4">
              <p className="text-4xl font-bold text-gray-900">
                {summary.avgDataCompleteness}%
              </p>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full"
                style={{ width: `${summary.avgDataCompleteness}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Avg Compliance Score
            </h3>
            <div className="flex items-baseline gap-4">
              <p className="text-4xl font-bold text-gray-900">
                {summary.avgComplianceScore}
              </p>
              <p className="text-gray-500">/100</p>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  summary.avgComplianceScore >= 70
                    ? "bg-green-600"
                    : summary.avgComplianceScore >= 50
                      ? "bg-yellow-600"
                      : "bg-red-600"
                }`}
                style={{ width: `${Math.min(100, summary.avgComplianceScore)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Action Items ({reminders.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {reminders.map((reminder) => (
              <div
                key={reminder.supplierId}
                className={`p-3 rounded text-sm ${
                  reminder.reminderType === "urgent"
                    ? "bg-red-100 text-red-800"
                    : reminder.reminderType === "friendly"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-blue-100 text-blue-800"
                }`}
              >
                <p className="font-medium">{reminder.supplierName}</p>
                <p className="text-xs mt-1">{reminder.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplier List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filtered.length} of {suppliers.length} suppliers
            </p>
            <button className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("")}
            className={`px-3 py-1 text-sm rounded-full ${
              !filterStatus
                ? "bg-gray-900 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            All
          </button>
          {["responded", "pending", "overdue", "never_contacted"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
              className={`px-3 py-1 text-sm rounded-full ${
                filterStatus === status
                  ? "bg-gray-900 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-b border-gray-200 flex gap-2">
          <p className="text-sm font-medium text-gray-700">Sort by:</p>
          {(["compliance", "issues", "days"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-2 py-1 text-xs rounded ${
                sortBy === option
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {option === "compliance"
                ? "Compliance Score"
                : option === "issues"
                  ? "Issues"
                  : "Days Since Contact"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Data Completeness
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Compliance Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Issues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Contact
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {supplier.name}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(supplier.responseStatus)}`}
                    >
                      {getStatusLabel(supplier.responseStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            supplier.dataCompleteness >= 70
                              ? "bg-green-500"
                              : supplier.dataCompleteness >= 40
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${supplier.dataCompleteness}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {supplier.dataCompleteness}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {supplier.complianceScore >= 70 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : supplier.complianceScore >= 50 ? (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {supplier.complianceScore}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {supplier.issueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        {supplier.issueCount}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {supplier.daysSinceContact !== null
                      ? `${supplier.daysSinceContact} days ago`
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
