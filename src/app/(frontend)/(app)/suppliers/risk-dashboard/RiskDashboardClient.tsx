"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  category: string;
  annualSpend: number | null;
  riskScore: number | null;
  riskTier: "low" | "medium" | "high" | "critical" | "unknown";
  dataCompleteness: number;
  unGcSignatory: boolean;
  lastCalculatedAt: string | null;
}

interface Stats {
  totalSuppliers: number;
  avgRiskScore: number | null;
  riskTierCounts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  dataQuality: {
    complete: number;
    partial: number;
    incomplete: number;
  };
}

type SortBy = "risk_score" | "spend" | "completeness" | "name";
type SortOrder = "asc" | "desc";

function getRiskColor(tier: "low" | "medium" | "high" | "critical" | "unknown"): string {
  switch (tier) {
    case "low":
      return "bg-green-100 text-green-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "critical":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getRiskIcon(tier: "low" | "medium" | "high" | "critical" | "unknown") {
  switch (tier) {
    case "low":
      return <CheckCircle2 className="w-4 h-4" />;
    case "medium":
      return <AlertCircle className="w-4 h-4" />;
    case "high":
    case "critical":
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return null;
  }
}

export function RiskDashboardClient({
  initialSuppliers,
  stats,
}: {
  initialSuppliers: Supplier[];
  stats: Stats;
}) {
  const [sortBy, setSortBy] = useState<SortBy>("risk_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    let result = [...initialSuppliers];

    if (searchTerm) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.id.includes(searchTerm),
      );
    }

    if (filterTier) {
      result = result.filter((s) => s.riskTier === filterTier);
    }

    if (filterCategory) {
      result = result.filter((s) => s.category === filterCategory);
    }

    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case "risk_score":
          aVal = a.riskScore ?? -1;
          bVal = b.riskScore ?? -1;
          break;
        case "spend":
          aVal = a.annualSpend ?? 0;
          bVal = b.annualSpend ?? 0;
          break;
        case "completeness":
          aVal = a.dataCompleteness;
          bVal = b.dataCompleteness;
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [initialSuppliers, sortBy, sortOrder, filterTier, filterCategory, searchTerm]);

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Supplier Name",
      "Category",
      "Annual Spend",
      "Risk Score",
      "Risk Tier",
      "Data Completeness %",
      "UN GC Signatory",
      "Last Calculated",
    ];
    const rows = filtered.map((s) => [
      s.name,
      s.category,
      s.annualSpend ?? "",
      s.riskScore ?? "",
      s.riskTier,
      s.dataCompleteness,
      s.unGcSignatory ? "Yes" : "No",
      s.lastCalculatedAt ?? "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risk-scores-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const categories = Array.from(new Set(initialSuppliers.map((s) => s.category)));

  return (
    <div className="space-y-8">
      {/* Header with KPIs */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Risk Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Monitor supplier ESG risk scores and data completeness
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm">Total Suppliers</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSuppliers}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm">Avg Risk Score</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.avgRiskScore !== null ? stats.avgRiskScore : "—"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-500 text-sm">Low Risk</p>
          <p className="text-2xl font-bold text-green-600">{stats.riskTierCounts.low}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-gray-500 text-sm">Medium Risk</p>
          <p className="text-2xl font-bold text-yellow-600">
            {stats.riskTierCounts.medium}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-gray-500 text-sm">High/Critical Risk</p>
          <p className="text-2xl font-bold text-red-600">
            {stats.riskTierCounts.high + stats.riskTierCounts.critical}
          </p>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Name or ID
            </label>
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Tier
            </label>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Tiers</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleExportCSV}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {filtered.length} of {initialSuppliers.length} suppliers
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    Supplier Name
                    {sortBy === "name" && <ArrowUpDown className="w-4 h-4" />}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("spend")}
                >
                  <div className="flex items-center gap-2">
                    Annual Spend
                    {sortBy === "spend" && <ArrowUpDown className="w-4 h-4" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("risk_score")}
                >
                  <div className="flex items-center gap-2">
                    Risk Score
                    {sortBy === "risk_score" && <ArrowUpDown className="w-4 h-4" />}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Tier
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("completeness")}
                >
                  <div className="flex items-center gap-2">
                    Completeness
                    {sortBy === "completeness" && <ArrowUpDown className="w-4 h-4" />}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No suppliers found matching your filters
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {supplier.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {supplier.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {supplier.annualSpend
                        ? `$${(supplier.annualSpend / 1000000).toFixed(1)}M`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {supplier.riskScore !== null ? supplier.riskScore : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(supplier.riskTier)}`}
                      >
                        {getRiskIcon(supplier.riskTier)}
                        {supplier.riskTier === "unknown"
                          ? "Not Calculated"
                          : supplier.riskTier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
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
                        <span className="text-sm text-gray-600">
                          {supplier.dataCompleteness}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/suppliers/${supplier.id}/risk-breakdown`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
