"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  IntensityMetrics,
  IntensityReport,
  IntensityTrend,
} from "@/lib/analytics/consumptionIntensity";

export default function ConsumptionIntensity() {
  const [metrics, setMetrics] = useState<IntensityMetrics | null>(null);
  const [report, setReport] = useState<IntensityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIntensity = async () => {
      try {
        const response = await fetch("/api/app/analytics/intensity");
        if (!response.ok) throw new Error("Failed to fetch intensity metrics");
        const data: {
          metrics?: IntensityMetrics;
          report?: IntensityReport;
        } = await response.json();
        setMetrics(data.metrics ?? null);
        setReport(data.report ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load intensity metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchIntensity();
  }, []);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No intensity data available yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          <CardTitle>Emissions Intensity Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 p-4 border rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Per Revenue</p>
              <p className="text-3xl font-bold">{metrics.perRevenue?.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">tCO2e per $M</p>
            </div>

            <div className="space-y-2 p-4 border rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Per Employee</p>
              <p className="text-3xl font-bold">{metrics.perEmployee?.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">tCO2e per employee</p>
            </div>

            {metrics.perUnit && (
              <div className="space-y-2 p-4 border rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">Per Unit</p>
                <p className="text-3xl font-bold">{metrics.perUnit?.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">tCO2e per unit</p>
              </div>
            )}
          </div>

          {report?.decouplingStatus && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Decoupling Status</AlertTitle>
              <AlertDescription className="mt-2">
                {report.decouplingStatus}
              </AlertDescription>
            </Alert>
          )}

          {report?.recommendations && report.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Recommendations</h3>
              <ul className="space-y-2">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {metrics.trends && metrics.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.trends.map((trend: IntensityTrend, idx) => (
                <div
                  key={idx}
                  className="flex justify-between p-2 border rounded hover:bg-muted text-sm"
                >
                  <span className="font-semibold">{trend.year}</span>
                  <span>{trend.intensity?.toFixed(2)} tCO2e/$M</span>
                  {trend.yoYChange ? (
                    <span
                      className={trend.yoYChange < 0 ? "text-green-600" : "text-red-600"}
                    >
                      {trend.yoYChange > 0 ? "+" : ""}
                      {trend.yoYChange?.toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
