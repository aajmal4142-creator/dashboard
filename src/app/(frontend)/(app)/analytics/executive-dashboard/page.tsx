"use client";

import { PageFrame } from "@/components/shell/PageFrame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface KPICard {
  id: string;
  title: string;
  value: number;
  unit: string;
  status: "green" | "yellow" | "red";
  trend: number;
  trendDirection: "up" | "down" | "neutral";
  comparison?: string;
  drill?: {
    route: string;
    params: Record<string, string>;
  };
}

interface ExecutiveDashboard {
  kpis: KPICard[];
  summary: {
    totalEmissions: number;
    scopeCoverage: { scope1: number; scope2: number; scope3: number };
    yearOverYearChange: number;
    targetProgress: number;
  };
  alerts: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
  }>;
  customLayout?: {
    gridColumns: number;
    order: string[];
  };
}

function StatusBadge({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  };

  const icons = {
    green: <CheckCircle className="w-4 h-4" />,
    yellow: <AlertTriangle className="w-4 h-4" />,
    red: <AlertCircle className="w-4 h-4" />,
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colors[status]}`}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("periodId") || "";
  const previousPeriodId = searchParams.get("previousPeriodId");

  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      if (!periodId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const url = new URL(
          "/api/app/analytics/executive-dashboard",
          window.location.origin,
        );
        url.searchParams.append("periodId", periodId);
        if (previousPeriodId)
          url.searchParams.append("previousPeriodId", previousPeriodId);

        const res = await fetch(url.toString());
        const data = (await res.json()) as { dashboard: ExecutiveDashboard };
        if (cancelled) return;
        setDashboard(data.dashboard);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, [periodId, previousPeriodId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg" />
        ))}
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

  if (!dashboard) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Select a reporting period to view the executive dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {dashboard.alerts.length > 0 && (
        <div className="space-y-3">
          {dashboard.alerts.map((alert, idx) => (
            <Alert
              key={idx}
              className={
                alert.severity === "critical"
                  ? "border-red-200 bg-red-50"
                  : alert.severity === "warning"
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-blue-200 bg-blue-50"
              }
            >
              <AlertCircle
                className={`h-4 w-4 ${
                  alert.severity === "critical"
                    ? "text-red-600"
                    : alert.severity === "warning"
                      ? "text-yellow-600"
                      : "text-blue-600"
                }`}
              />
              <AlertDescription
                className={
                  alert.severity === "critical"
                    ? "text-red-800"
                    : alert.severity === "warning"
                      ? "text-yellow-800"
                      : "text-blue-800"
                }
              >
                <strong>{alert.title}</strong> — {alert.description}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Summary Section */}
      <div className="from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Emissions</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {dashboard.summary.totalEmissions.toFixed(0)}
            </p>
            <p className="text-xs text-blue-700 mt-1">tCO2e</p>
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">YoY Change</p>
            <div className="flex items-center gap-2 mt-1">
              {dashboard.summary.yearOverYearChange > 0 ? (
                <TrendingUp className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-500" />
              )}
              <p className="text-2xl font-bold text-blue-900">
                {dashboard.summary.yearOverYearChange > 0 ? "+" : ""}
                {dashboard.summary.yearOverYearChange.toFixed(1)}%
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Scope Coverage</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>S1: {dashboard.summary.scopeCoverage.scope1.toFixed(0)} tCO2e</p>
              <p>S2: {dashboard.summary.scopeCoverage.scope2.toFixed(0)} tCO2e</p>
              <p>S3: {dashboard.summary.scopeCoverage.scope3.toFixed(0)} tCO2e</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Target Progress</p>
            <div className="bg-white rounded p-2 mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, dashboard.summary.targetProgress)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-blue-700 mt-1">
                {dashboard.summary.targetProgress.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div>
        <h2 className="text-lg font-bold mb-4">Key Performance Indicators</h2>
        <div
          className={`grid gap-4`}
          style={{
            gridTemplateColumns: `repeat(${dashboard.customLayout?.gridColumns || 3}, minmax(0, 1fr))`,
          }}
        >
          {dashboard.kpis.map((kpi) => (
            <Link
              key={kpi.id}
              href={kpi.drill?.route || "#"}
              className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-600 font-medium">{kpi.title}</p>
                  <p className="text-2xl font-bold mt-2">{kpi.value.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.unit}</p>
                </div>
                <StatusBadge status={kpi.status} />
              </div>

              <div className="flex items-center justify-between text-xs">
                <p className="text-gray-600">{kpi.comparison}</p>
                <div
                  className={`flex items-center gap-1 font-semibold ${
                    kpi.trendDirection === "down" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {kpi.trendDirection === "up" && <TrendingUp className="w-4 h-4" />}
                  {kpi.trendDirection === "down" && <TrendingDown className="w-4 h-4" />}
                  {kpi.trend > 0 ? "+" : ""}
                  {kpi.trend.toFixed(1)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Drill-Down Links */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href={`/analytics/root-cause?metricKey=derived.energy_total_mwh&periodId=${periodId}`}
            className="p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 text-center text-sm font-medium group"
          >
            <Zap className="w-5 h-5 mx-auto mb-2 text-gray-600 group-hover:text-blue-600" />
            Root Cause
          </Link>
          <Link
            href={`/analytics?metric=emissions_intensity&period=${periodId}`}
            className="p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 text-center text-sm font-medium group"
          >
            <AlertCircle className="w-5 h-5 mx-auto mb-2 text-gray-600 group-hover:text-blue-600" />
            Intensity
          </Link>
          <Link
            href={`/analytics?metric=renewable_percentage&period=${periodId}`}
            className="p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 text-center text-sm font-medium group"
          >
            <CheckCircle className="w-5 h-5 mx-auto mb-2 text-gray-600 group-hover:text-blue-600" />
            Renewables
          </Link>
          <Link
            href={`/frameworks/taxonomy?periodId=${periodId}`}
            className="p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 text-center text-sm font-medium group"
          >
            <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-gray-600 group-hover:text-blue-600" />
            Taxonomy
          </Link>
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

export default function ExecutiveDashboardPage() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("periodId");

  return (
    <PageFrame eyebrow="Analytics" title="Executive Dashboard">
      <div className="space-y-6">
        {!periodId && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Select a reporting period to view the executive dashboard.
            </AlertDescription>
          </Alert>
        )}

        <Suspense
          fallback={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg" />
              ))}
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </div>
    </PageFrame>
  );
}
