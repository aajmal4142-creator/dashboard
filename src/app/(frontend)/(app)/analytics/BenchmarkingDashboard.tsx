"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp } from "lucide-react";
import type { PeerBenchmark } from "@/lib/analytics/benchmarking";

type AnonymizedPeer = {
  id: string;
  name: string;
  industry: string;
  size: string;
};

type BenchmarkResponse = {
  available: boolean;
  message?: string;
  benchmark?: PeerBenchmark;
  insights?: string[];
  peers?: AnonymizedPeer[];
};

export default function BenchmarkingDashboard() {
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        const response = await fetch(
          "/api/app/analytics/benchmarks?metricKey=electricity_kwh",
        );
        if (!response.ok) throw new Error("Failed to fetch benchmarks");
        const data: BenchmarkResponse = await response.json();
        setBenchmark(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load benchmarking data");
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
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

  if (!benchmark?.available || !benchmark.benchmark) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Benchmarking Not Available</AlertTitle>
        <AlertDescription>
          {benchmark?.message ||
            "Not enough peers to generate benchmarks. Check back later."}
        </AlertDescription>
      </Alert>
    );
  }

  const percentile = benchmark.benchmark.percentileRank || 0;
  const statusColor =
    percentile >= 90
      ? "text-green-600"
      : percentile >= 65
        ? "text-blue-600"
        : percentile >= 35
          ? "text-yellow-600"
          : "text-red-600";

  const statusText =
    percentile >= 90
      ? "Best in Class"
      : percentile >= 65
        ? "Above Median"
        : percentile >= 35
          ? "At Median"
          : "Below Median";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Peer Benchmarking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your Position</p>
              <div className={`text-4xl font-bold ${statusColor}`}>
                {percentile.toFixed(0)}th percentile
              </div>
              <p className="text-sm">{statusText}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your Value</p>
              <div className="text-4xl font-bold">
                {benchmark.benchmark.yourValue?.toFixed(2) ?? "N/A"}
              </div>
              <p className="text-sm">{benchmark.benchmark.metricKey}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Peer Distribution</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>10th percentile</span>
                <span className="font-mono">{benchmark.benchmark.p10?.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${Math.min(100, (percentile / 100) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>90th percentile</span>
                <span className="font-mono">{benchmark.benchmark.p90?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">25th</p>
              <p className="text-lg font-semibold">
                {benchmark.benchmark.p25?.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Median</p>
              <p className="text-lg font-semibold">
                {benchmark.benchmark.p50?.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">75th</p>
              <p className="text-lg font-semibold">
                {benchmark.benchmark.p75?.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {benchmark.insights && benchmark.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {benchmark.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {benchmark.peers && benchmark.peers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anonymized Peers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {benchmark.peers.map((peer, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm p-2 rounded hover:bg-muted"
                >
                  <span>{peer.name}</span>
                  <span className="text-muted-foreground text-xs">{peer.industry}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
