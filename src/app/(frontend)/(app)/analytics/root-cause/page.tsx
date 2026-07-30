"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageFrame } from "@/components/shell/PageFrame";
import { AlertCircle, Download, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RootCauseAnalysis {
  metricKey: string;
  totalValue: number;
  previousValue: number;
  change: number;
  percentageChange: number;
  contributors: Array<{
    contributor: string;
    value: number;
    percentageChange: number;
    percentageOfTotal: number;
    contribution: "increase" | "decrease" | "neutral";
  }>;
  dimensions: {
    bySupplier: Record<string, { value: number; change: number }>;
    byFacility: Record<string, { value: number; change: number }>;
    byCategory: Record<string, { value: number; change: number }>;
    bySource: Record<string, { value: number; change: number }>;
  };
  topDrivers: Array<{ dimension: string; contributor: string; impact: number }>;
}

function RootCauseContent() {
  const searchParams = useSearchParams();
  const metricKey = searchParams.get("metricKey") || "derived.energy_total_mwh";
  const periodId = searchParams.get("periodId") || "";
  const previousPeriodId = searchParams.get("previousPeriodId");

  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDimension, setSelectedDimension] =
    useState<keyof RootCauseAnalysis["dimensions"]>("bySupplier");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalysis() {
      try {
        setLoading(true);
        const url = new URL("/api/app/analytics/root-cause", window.location.origin);
        url.searchParams.append("metricKey", metricKey);
        if (periodId) url.searchParams.append("periodId", periodId);
        if (previousPeriodId)
          url.searchParams.append("previousPeriodId", previousPeriodId);

        const res = await fetch(url.toString());
        const data = (await res.json()) as { analysis: RootCauseAnalysis };
        if (cancelled) return;
        setAnalysis(data.analysis);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchAnalysis();
    return () => {
      cancelled = true;
    };
  }, [metricKey, periodId, previousPeriodId]);

  const handleExport = async (format: "csv" | "json") => {
    try {
      setExporting(true);
      const url = new URL("/api/app/analytics/root-cause", window.location.origin);
      url.searchParams.append("metricKey", metricKey);
      if (periodId) url.searchParams.append("periodId", periodId);
      if (previousPeriodId) url.searchParams.append("previousPeriodId", previousPeriodId);
      url.searchParams.append("export", format);

      const res = await fetch(url.toString());
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `root-cause-${metricKey}-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analysis) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No analysis available. Select a metric and period.
        </AlertDescription>
      </Alert>
    );
  }

  const dimension = analysis.dimensions[selectedDimension];
  const dimensionEntries = Object.entries(dimension)
    .map(([key, value]) => ({
      name: key,
      ...value,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{metricKey}</h1>
          <p className="text-sm text-gray-600">
            Total Change: {analysis.change.toFixed(2)} (
            {analysis.percentageChange.toFixed(2)}%)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 font-medium">Current Value</p>
          <p className="text-3xl font-bold mt-2">{analysis.totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 font-medium">Previous Value</p>
          <p className="text-3xl font-bold mt-2">{analysis.previousValue.toFixed(2)}</p>
        </div>
        <div
          className={`bg-white rounded-lg border p-6 ${
            analysis.change > 0
              ? "border-red-200 bg-red-50"
              : "border-green-200 bg-green-50"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              analysis.change > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            Change
          </p>
          <div className="flex items-center gap-2 mt-2">
            {analysis.change > 0 ? (
              <TrendingUp className="w-6 h-6 text-red-600" />
            ) : (
              <TrendingDown className="w-6 h-6 text-green-600" />
            )}
            <p
              className={`text-3xl font-bold ${
                analysis.change > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {analysis.change > 0 ? "+" : ""}
              {analysis.percentageChange.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Top Drivers */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">Top 5 Drivers of Change</h3>
        <div className="space-y-3">
          {analysis.topDrivers.map((driver, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
            >
              <div>
                <p className="font-medium text-sm">
                  {driver.dimension}: {driver.contributor}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{driver.impact.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Impact</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dimension Drill-Down */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Drill-Down Analysis</h3>
          <div className="flex gap-2">
            <select
              value={selectedDimension}
              onChange={(e) =>
                setSelectedDimension(
                  e.target.value as keyof RootCauseAnalysis["dimensions"],
                )
              }
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="bySupplier">By Supplier</option>
              <option value="byFacility">By Facility</option>
              <option value="byCategory">By Category</option>
              <option value="bySource">By Source</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {selectedDimension.replace("by", "")}
                </th>
                <th className="px-4 py-3 text-right font-medium">Current Value</th>
                <th className="px-4 py-3 text-right font-medium">Change</th>
                <th className="px-4 py-3 text-right font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {dimensionEntries.map((item) => (
                <tr key={item.name} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-right">{item.value.toFixed(2)}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      item.change > 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {item.change > 0 ? "+" : ""}
                    {item.change.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {analysis.totalValue > 0
                      ? ((item.value / analysis.totalValue) * 100).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contributors Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">Supplier Contributors (Top 10)</h3>
        <div className="space-y-3">
          {analysis.contributors.slice(0, 10).map((contributor, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm">{contributor.contributor}</p>
                <p className="text-xs text-gray-600">
                  {contributor.percentageOfTotal.toFixed(1)}% of total
                </p>
              </div>
              <div className="w-48 bg-gray-200 rounded h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    contributor.contribution === "increase"
                      ? "bg-red-500"
                      : contributor.contribution === "decrease"
                        ? "bg-green-500"
                        : "bg-gray-400"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (contributor.value /
                        Math.max(...analysis.contributors.map((c) => c.value))) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              <div className="text-right min-w-24">
                <p className="font-bold text-sm">{contributor.value.toFixed(2)}</p>
                <p
                  className={`text-xs ${
                    contributor.percentageChange > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {contributor.percentageChange > 0 ? "+" : ""}
                  {contributor.percentageChange.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/analytics"
        className="text-gray-600 hover:text-gray-900 underline text-sm"
      >
        ← Back to Analytics
      </Link>
    </div>
  );
}

export default function RootCausePage() {
  return (
    <PageFrame eyebrow="Analytics" title="Root Cause Analysis">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 animate-pulse rounded-lg" />
          </div>
        }
      >
        <RootCauseContent />
      </Suspense>
    </PageFrame>
  );
}
