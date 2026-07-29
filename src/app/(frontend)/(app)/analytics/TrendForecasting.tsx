"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ForecastSummary = {
  id: string;
  metricKey: string;
  model: string;
  trendDirection?: string | null;
  seasonalityDetected?: boolean | null;
  forecastPeriodMonths: number;
  accuracy?: {
    mape?: number | null;
  } | null;
};

export default function TrendForecasting() {
  const [forecasts, setForecasts] = useState<ForecastSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecasts = async () => {
      try {
        const response = await fetch(
          "/api/app/analytics/forecasts?metricKey=electricity_kwh",
        );
        if (!response.ok) {
          throw new Error("Failed to fetch forecasts");
        }
        const data: { forecasts?: ForecastSummary[] } = await response.json();
        setForecasts(data.forecasts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load forecasts");
      } finally {
        setLoading(false);
      }
    };

    fetchForecasts();
  }, []);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <CardTitle>Trend Forecasting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {forecasts.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No forecasts available yet. Add historical data to generate trend
                forecasts.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {forecasts.map((forecast) => (
                <div key={forecast.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{forecast.metricKey}</h3>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {forecast.model.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Trend</span>
                      <p className="font-semibold capitalize">
                        {forecast.trendDirection}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Accuracy (MAPE)</span>
                      <p className="font-semibold">
                        {forecast.accuracy?.mape?.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Seasonality</span>
                      <p className="font-semibold">
                        {forecast.seasonalityDetected ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Forecast Period</span>
                      <p className="font-semibold">{forecast.forecastPeriodMonths}mo</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Forecasts use ARIMA, ETS, and hybrid models to predict future trends with
          confidence intervals.
        </AlertDescription>
      </Alert>
    </div>
  );
}
