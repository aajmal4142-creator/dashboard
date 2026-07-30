"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpDown, Download } from "lucide-react";

import { PageCard, PageFrame } from "@/components/shell/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";

type RiskBadge = "low" | "medium" | "high";
type RiskTier = "low" | "medium" | "high" | "critical" | "unknown";

interface Supplier {
  id: string;
  name: string;
  category: string;
  annualSpend: number | null;
  riskScore: number | null;
  riskTier: RiskTier;
  badge: RiskBadge | null;
  dataCompleteness: number;
  unGcSignatory: boolean;
  lastCalculatedAt: string | null;
  highRiskAlert?: boolean;
  environmentalScore?: number | null;
  socialScore?: number | null;
  governanceScore?: number | null;
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
  highAlertCount?: number;
  dataQuality: {
    complete: number;
    partial: number;
    incomplete: number;
  };
}

type SortBy = "risk_score" | "spend" | "completeness" | "name";
type SortOrder = "asc" | "desc";

function badgeVariant(badge: RiskBadge | null): "signal" | "amber" | "rust" | "default" {
  if (badge === "low") return "signal";
  if (badge === "medium") return "amber";
  if (badge === "high") return "rust";
  return "default";
}

function displayBadge(supplier: Supplier): RiskBadge | null {
  if (supplier.badge) return supplier.badge;
  if (supplier.riskTier === "low") return "low";
  if (supplier.riskTier === "medium") return "medium";
  if (supplier.riskTier === "high" || supplier.riskTier === "critical") return "high";
  return null;
}

function badgeLabel(badge: RiskBadge | null): string {
  if (!badge) return "Not scored";
  if (badge === "low") return "Low";
  if (badge === "medium") return "Med";
  return "High";
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
  const [filterTier, setFilterTier] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const highAlertCount =
    stats.highAlertCount ??
    initialSuppliers.filter(
      (s) => s.highRiskAlert || s.riskTier === "high" || s.riskTier === "critical",
    ).length;

  const filtered = useMemo(() => {
    let result = [...initialSuppliers];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.id.includes(searchTerm),
      );
    }

    if (filterTier === "high") {
      result = result.filter(
        (s) => s.riskTier === "high" || s.riskTier === "critical" || s.badge === "high",
      );
    } else if (filterTier) {
      result = result.filter((s) => s.riskTier === filterTier || s.badge === filterTier);
    }

    if (filterCategory) {
      result = result.filter((s) => s.category === filterCategory);
    }

    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
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

  function handleSort(column: SortBy) {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }

  function handleExportCSV() {
    const headers = [
      "Supplier Name",
      "Category",
      "Annual Spend",
      "Risk Score",
      "Badge",
      "Environmental",
      "Social",
      "Governance",
      "Data Completeness %",
      "UN GC Signatory",
      "Last Calculated",
    ];
    const rows = filtered.map((s) => [
      s.name,
      s.category,
      s.annualSpend ?? "",
      s.riskScore ?? "",
      displayBadge(s) ?? "",
      s.environmentalScore ?? "",
      s.socialScore ?? "",
      s.governanceScore ?? "",
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
  }

  const categories = Array.from(new Set(initialSuppliers.map((s) => s.category)));

  return (
    <PageFrame
      eyebrow="Supply chain"
      title="Supplier risk"
      help="ESG risk score = Environmental 40% + Social 30% + Governance 30%. Higher is worse."
      actions={
        <Button type="button" variant="outline" onClick={handleExportCSV}>
          <Download className="size-4" />
          Export CSV
        </Button>
      }
    >
      {highAlertCount > 0 ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-[6px] border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            High-risk alert:{" "}
            <span className="font-data font-semibold">{highAlertCount}</span> supplier
            {highAlertCount === 1 ? "" : "s"} need mitigation.
          </span>
          <button
            type="button"
            className="ml-auto text-[12px] font-semibold underline"
            onClick={() => setFilterTier("high")}
          >
            Show High
          </button>
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PageCard>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Total
          </p>
          <Metric value={stats.totalSuppliers} className="mt-1" />
        </PageCard>
        <PageCard>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Avg score
          </p>
          <p className="mt-1 font-data text-[28px] font-bold text-ink">
            {stats.avgRiskScore !== null ? stats.avgRiskScore : "—"}
          </p>
        </PageCard>
        <PageCard>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Low
          </p>
          <p className="mt-1 font-data text-[28px] font-bold text-signal">
            {stats.riskTierCounts.low}
          </p>
        </PageCard>
        <PageCard>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Med
          </p>
          <p className="mt-1 font-data text-[28px] font-bold text-amber">
            {stats.riskTierCounts.medium}
          </p>
        </PageCard>
        <PageCard>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            High
          </p>
          <p className="mt-1 font-data text-[28px] font-bold text-rust">
            {stats.riskTierCounts.high + stats.riskTierCounts.critical}
          </p>
        </PageCard>
      </div>

      <PageCard className="mb-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-[12px] text-ink-muted">
            Search
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name or id"
              className="mt-1 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-ink"
            />
          </label>
          <label className="block text-[12px] text-ink-muted">
            Badge
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-ink"
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="block text-[12px] text-ink-muted">
            Category
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-ink"
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        </div>
      </PageCard>

      <PageCard>
        <p className="mb-3 text-[12px] text-ink-muted">
          Showing <span className="font-data text-ink">{filtered.length}</span> of{" "}
          <span className="font-data text-ink">{initialSuppliers.length}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <th
                  className="cursor-pointer py-2 pr-3"
                  onClick={() => handleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    Supplier
                    {sortBy === "name" ? <ArrowUpDown className="size-3" /> : null}
                  </span>
                </th>
                <th className="py-2 pr-3">Category</th>
                <th
                  className="cursor-pointer py-2 pr-3"
                  onClick={() => handleSort("spend")}
                >
                  <span className="inline-flex items-center gap-1">
                    Spend
                    {sortBy === "spend" ? <ArrowUpDown className="size-3" /> : null}
                  </span>
                </th>
                <th
                  className="cursor-pointer py-2 pr-3"
                  onClick={() => handleSort("risk_score")}
                >
                  <span className="inline-flex items-center gap-1">
                    Score
                    {sortBy === "risk_score" ? <ArrowUpDown className="size-3" /> : null}
                  </span>
                </th>
                <th className="py-2 pr-3">Badge</th>
                <th
                  className="cursor-pointer py-2 pr-3"
                  onClick={() => handleSort("completeness")}
                >
                  <span className="inline-flex items-center gap-1">
                    Completeness
                    {sortBy === "completeness" ? (
                      <ArrowUpDown className="size-3" />
                    ) : null}
                  </span>
                </th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    No suppliers match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => {
                  const badge = displayBadge(supplier);
                  return (
                    <tr
                      key={supplier.id}
                      className="border-b border-rule last:border-b-0"
                    >
                      <td className="py-2.5 pr-3 font-medium text-ink">
                        {supplier.name}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-muted">{supplier.category}</td>
                      <td className="py-2.5 pr-3 font-data text-ink">
                        {supplier.annualSpend != null
                          ? `${(supplier.annualSpend / 1_000_000).toFixed(1)}M`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-data font-semibold text-ink">
                        {supplier.riskScore !== null ? supplier.riskScore : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={badgeVariant(badge)}>{badgeLabel(badge)}</Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-data text-ink">
                          {supplier.dataCompleteness}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Link
                          href={`/suppliers/${supplier.id}/risk-breakdown`}
                          className="text-accent hover:text-accent-hover"
                        >
                          Breakdown
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PageCard>
    </PageFrame>
  );
}
