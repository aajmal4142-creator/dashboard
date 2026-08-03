"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageFrame } from "@/components/shell/PageFrame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BarChart3, TrendingUp, Zap, Target } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import BenchmarkingDashboard from "./BenchmarkingDashboard";
import ScenarioBuilder from "./ScenarioBuilder";
import PathwayPlanner from "./PathwayPlanner";
import TrendForecasting from "./TrendForecasting";
import ConsumptionIntensity from "./ConsumptionIntensity";

function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

const TAB_VALUES = [
  "benchmarks",
  "scenarios",
  "pathways",
  "forecasts",
  "intensity",
] as const;

function resolveTab(raw: string | null): (typeof TAB_VALUES)[number] {
  if (raw && (TAB_VALUES as readonly string[]).includes(raw)) {
    return raw as (typeof TAB_VALUES)[number];
  }
  return "benchmarks";
}

function AnalyticsTabs() {
  const searchParams = useSearchParams();
  const defaultTab = resolveTab(searchParams.get("tab"));

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="benchmarks" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Benchmarks</span>
        </TabsTrigger>
        <TabsTrigger value="scenarios" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Scenarios</span>
        </TabsTrigger>
        <TabsTrigger value="pathways" className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          <span className="hidden sm:inline">Pathways</span>
        </TabsTrigger>
        <TabsTrigger value="forecasts" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span className="hidden sm:inline">Forecasts</span>
        </TabsTrigger>
        <TabsTrigger value="intensity" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Intensity</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="benchmarks" className="space-y-4 mt-4">
        <Suspense fallback={<AnalyticsLoading />}>
          <BenchmarkingDashboard />
        </Suspense>
      </TabsContent>

      <TabsContent value="scenarios" className="space-y-4 mt-4">
        <Suspense fallback={<AnalyticsLoading />}>
          <ScenarioBuilder />
        </Suspense>
      </TabsContent>

      <TabsContent value="pathways" className="space-y-4 mt-4">
        <Suspense fallback={<AnalyticsLoading />}>
          <PathwayPlanner />
        </Suspense>
      </TabsContent>

      <TabsContent value="forecasts" className="space-y-4 mt-4">
        <Suspense fallback={<AnalyticsLoading />}>
          <TrendForecasting />
        </Suspense>
      </TabsContent>

      <TabsContent value="intensity" className="space-y-4 mt-4">
        <Suspense fallback={<AnalyticsLoading />}>
          <ConsumptionIntensity />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

export default function AnalyticsPage() {
  return (
    <PageFrame eyebrow="Analytics" title="Analytics & Insights">
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This analytics suite provides peer benchmarking, scenario modeling,
            decarbonization pathways, trend forecasting, and intensity metrics for
            strategic decision-making. For YoY and dimensional splits, open{" "}
            <Link
              href="/analytics/compare"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Comparison tools
            </Link>
            . For cost-ranked abatement levers, open{" "}
            <Link
              href="/analytics/macc"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              MACC / abatement ROI
            </Link>
            .
          </AlertDescription>
        </Alert>

        <Suspense fallback={<AnalyticsLoading />}>
          <AnalyticsTabs />
        </Suspense>
      </div>
    </PageFrame>
  );
}
