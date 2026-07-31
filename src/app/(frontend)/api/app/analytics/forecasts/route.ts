import type { Where } from "payload";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { selectBestForecastModel } from "@/lib/analytics/trendForecasting";

/**
 * GET /api/app/analytics/forecasts
 * List trend forecasts for the active organisation (Membership).
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const metricKey = url.searchParams.get("metricKey");
    const scenario = url.searchParams.get("scenario");
    const methodology = url.searchParams.get("methodology");

    const payload = await getPayload({ config });

    const clauses: Where[] = [{ organisation: { equals: ctx.activeOrg.id } }];
    if (metricKey) clauses.push({ metricKey: { equals: metricKey } });
    if (scenario) clauses.push({ scenario: { equals: scenario } });
    if (methodology) clauses.push({ methodology: { equals: methodology } });

    const where: Where = clauses.length === 1 ? clauses[0]! : { and: clauses };

    const forecasts = await payload.find({
      collection: "trend-forecasts",
      where,
      sort: "-createdAt",
      limit: 50,
    });

    return NextResponse.json({
      forecasts: forecasts.docs,
      total: forecasts.totalDocs,
    });
  } catch (error) {
    console.error("Forecasts list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/analytics/forecasts
 * Legacy ARIMA/ETS path — prefer POST /api/app/analytics/forecasts/calculate.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      metricKey?: string;
      forecastPeriods?: number;
    };
    if (!body.metricKey) {
      return NextResponse.json({ error: "metricKey is required" }, { status: 400 });
    }

    const payload = await getPayload({ config });

    const datapoints = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { metricKey: { equals: body.metricKey } },
        ],
      },
      sort: "createdAt",
      limit: 100,
    });

    if (datapoints.docs.length < 3) {
      return NextResponse.json(
        { error: "Not enough historical data (minimum 3 points required)" },
        { status: 400 },
      );
    }

    const historicalData = datapoints.docs
      .map((dp) => ({
        date: new Date(dp.createdAt),
        value: typeof dp.value === "number" ? dp.value : 0,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const model = selectBestForecastModel(historicalData, body.forecastPeriods || 12);

    const created = await payload.create({
      collection: "trend-forecasts",
      data: {
        organisation: ctx.activeOrg.id,
        metricKey: body.metricKey,
        model: model.model,
        baselineDate: new Date().toISOString(),
        forecastPeriodMonths: body.forecastPeriods || 12,
        methodology: "legacy_timeseries",
        lastCalculatedAt: new Date().toISOString(),
        forecastData: model.forecasts.map((f) => ({
          month: Math.floor(
            (f.date.getTime() -
              historicalData[historicalData.length - 1]!.date.getTime()) /
              (30 * 24 * 60 * 60 * 1000),
          ),
          date: f.date.toISOString(),
          forecast: f.forecast,
          lowerBound80: f.lowerBound80,
          upperBound80: f.upperBound80,
          lowerBound95: f.lowerBound95,
          upperBound95: f.upperBound95,
        })),
        historicalData: historicalData.map((d) => ({
          date: d.date.toISOString(),
          actualValue: d.value,
        })),
        accuracy: model.accuracy,
        trendDirection: model.trendDirection,
        seasonalityDetected: model.seasonalityDetected,
      },
    });

    return NextResponse.json(
      {
        forecast: created,
        model: model.model,
        accuracy: model.accuracy,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Forecast creation error:", error);
    return NextResponse.json({ error: "Failed to create forecast" }, { status: 500 });
  }
}
