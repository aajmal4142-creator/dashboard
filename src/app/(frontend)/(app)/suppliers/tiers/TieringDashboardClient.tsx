"use client";

import { useState } from "react";
import { BarChart3, PieChart, ArrowUpDown, Download } from "lucide-react";
import type { SupplierTier } from "@/lib/suppliers/categorizationEngine";

interface Supplier {
  id: string;
  name: string;
  tier: SupplierTier;
  spend: number;
  importance: number;
  template: "full" | "abbreviated" | "minimal";
  slaTargetDays: number;
}

interface Distribution {
  byCount: Record<SupplierTier, { count: number; pct: number }>;
  bySpend: Record<SupplierTier, { spend: number; pct: number }>;
}

interface Summary {
  processed: number;
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  errors: string[];
}

function getTierLabel(tier: SupplierTier): string {
  switch (tier) {
    case "tier_1":
      return "Tier 1 (Direct)";
    case "tier_2":
      return "Tier 2 (Indirect)";
    case "tier_3":
      return "Tier 3 (Second-level)";
    case "tier_4":
      return "Tier 4 (Third-level)";
    default:
      return tier;
  }
}

function getTierColor(tier: SupplierTier): string {
  switch (tier) {
    case "tier_1":
      return "bg-red-100 text-red-800";
    case "tier_2":
      return "bg-orange-100 text-orange-800";
    case "tier_3":
      return "bg-yellow-100 text-yellow-800";
    case "tier_4":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function TieringDashboardClient({
  suppliers,
  distribution,
  summary,
}: {
  suppliers: Supplier[];
  distribution: Distribution;
  summary: Summary;
}) {
  const [sortBy, setSortBy] = useState<"spend" | "importance" | "name">("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterTier, setFilterTier] = useState<SupplierTier | "">();

  const filteredSuppliers = suppliers
    .filter((s) => !filterTier || s.tier === filterTier)
    .sort((a, b) => {
      let aVal, bVal;
      if (sortBy === "spend") {
        aVal = a.spend;
        bVal = b.spend;
      } else if (sortBy === "importance") {
        aVal = a.importance;
        bVal = b.importance;
      } else {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const handleSort = (column: "spend" | "importance" | "name") => {
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
      "Tier",
      "Annual Spend",
      "Importance Score",
      "Data Template",
      "SLA Target Days",
    ];
    const rows = filteredSuppliers.map((s) => [
      s.name,
      getTierLabel(s.tier),
      s.spend,
      s.importance.toFixed(1),
      s.template,
      s.slaTargetDays,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-tiers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Supplier Tiering</h1>
        <p className="text-gray-500 mt-2">
          Classify suppliers by criticality and optimize data collection
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <p className="text-gray-500 text-xs uppercase font-semibold">Total Suppliers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.processed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-gray-500 text-xs uppercase font-semibold">Tier 1 (Direct)</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{summary.tier1}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <p className="text-gray-500 text-xs uppercase font-semibold">
            Tier 2 (Indirect)
          </p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{summary.tier2}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-gray-500 text-xs uppercase font-semibold">Tier 3</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.tier3}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-500 text-xs uppercase font-semibold">Tier 4</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summary.tier4}</p>
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Count */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Supplier Count by Tier
          </h3>
          <div className="space-y-3">
            {(["tier_1", "tier_2", "tier_3", "tier_4"] as SupplierTier[]).map((tier) => (
              <div key={tier}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium text-gray-700">
                    {getTierLabel(tier)}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {distribution.byCount[tier].count} (
                    {distribution.byCount[tier].pct.toFixed(1)}%)
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      tier === "tier_1"
                        ? "bg-red-500"
                        : tier === "tier_2"
                          ? "bg-orange-500"
                          : tier === "tier_3"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                    }`}
                    style={{ width: `${distribution.byCount[tier].pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Spend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Spend Distribution by Tier
          </h3>
          <div className="space-y-3">
            {(["tier_1", "tier_2", "tier_3", "tier_4"] as SupplierTier[]).map((tier) => (
              <div key={tier}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium text-gray-700">
                    {getTierLabel(tier)}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    ${(distribution.bySpend[tier].spend / 1000000).toFixed(1)}M (
                    {distribution.bySpend[tier].pct.toFixed(1)}%)
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      tier === "tier_1"
                        ? "bg-red-500"
                        : tier === "tier_2"
                          ? "bg-orange-500"
                          : tier === "tier_3"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                    }`}
                    style={{ width: `${distribution.bySpend[tier].pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tier Details & Data Collection Templates */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Data Collection by Tier</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <h4 className="font-semibold text-red-900 mb-2">Tier 1: Direct Suppliers</h4>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• Full questionnaire (30 questions)</li>
              <li>• All Scope 1, 2, 3</li>
              <li>• SLA: 30 days</li>
              <li>• Priority: Maximum</li>
            </ul>
          </div>

          <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
            <h4 className="font-semibold text-orange-900 mb-2">
              Tier 2: Indirect Suppliers
            </h4>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• Abbreviated questionnaire (15 questions)</li>
              <li>• Core Scope 1, 2 only</li>
              <li>• SLA: 45 days</li>
              <li>• Priority: High</li>
            </ul>
          </div>

          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">Tier 3: Second-level</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Minimal questionnaire (5 questions)</li>
              <li>• High-level emissions only</li>
              <li>• SLA: 60 days</li>
              <li>• Priority: Medium</li>
            </ul>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Tier 4: Third-level</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• No active collection</li>
              <li>• Use public data only</li>
              <li>• SLA: 90 days</li>
              <li>• Priority: Low</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supplier List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredSuppliers.length} of {suppliers.length} suppliers
            </p>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 flex gap-2">
          <button
            onClick={() => setFilterTier("")}
            className={`px-3 py-1 text-sm rounded-full ${
              !filterTier
                ? "bg-gray-900 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            All
          </button>
          {(["tier_1", "tier_2", "tier_3", "tier_4"] as SupplierTier[]).map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(filterTier === tier ? "" : tier)}
              className={`px-3 py-1 text-sm rounded-full ${
                filterTier === tier
                  ? "bg-gray-900 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {getTierLabel(tier)}
            </button>
          ))}
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
                  Tier
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
                  onClick={() => handleSort("importance")}
                >
                  <div className="flex items-center gap-2">
                    Importance
                    {sortBy === "importance" && <ArrowUpDown className="w-4 h-4" />}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SLA (Days)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No suppliers in this tier
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {supplier.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTierColor(supplier.tier)}`}
                      >
                        {getTierLabel(supplier.tier)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      ${(supplier.spend / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, supplier.importance)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">
                          {supplier.importance.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                      {supplier.template}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {supplier.slaTargetDays}
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
