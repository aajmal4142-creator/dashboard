import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { buildExecutiveDashboard } from "@/lib/analytics/executiveDashboard";

function accumulateScopeMetrics(
  docs: Array<{ metricKey: string; value?: number | null }>,
  metrics: Record<string, number>,
): void {
  docs.forEach((dp) => {
    const metricKey = dp.metricKey;
    const value = dp.value ?? 0;
    if (metricKey.includes("scope1") || metricKey === "derived.scope1_emissions") {
      metrics.scope1_emissions = (metrics.scope1_emissions ?? 0) + value;
    } else if (metricKey.includes("scope2") || metricKey === "derived.scope2_emissions") {
      metrics.scope2_emissions = (metrics.scope2_emissions ?? 0) + value;
    } else if (metricKey.includes("scope3") || metricKey === "derived.scope3_emissions") {
      metrics.scope3_emissions = (metrics.scope3_emissions ?? 0) + value;
    }
  });
}

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");
    const previousPeriodId = url.searchParams.get("previousPeriodId");

    const payload = await getPayload({ config });

    if (!periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 });
    }

    // Get available periods to show period selector
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 10,
      sort: "-startDate",
      overrideAccess: true,
    });

    // Fetch current period metrics
    const currentData = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
        ],
      },
      limit: 10000,
      overrideAccess: true,
    });

    const currentMetrics: Record<string, number> = {
      total_emissions: 0,
      scope1_emissions: 0,
      scope2_emissions: 0,
      scope3_emissions: 0,
      renewable_percentage: 0,
      emissions_intensity: 0,
      waste_diversion: 0,
    };

    accumulateScopeMetrics(currentData.docs, currentMetrics);

    currentMetrics.total_emissions =
      (currentMetrics.scope1_emissions ?? 0) +
      (currentMetrics.scope2_emissions ?? 0) +
      (currentMetrics.scope3_emissions ?? 0);

    // Calculate other metrics from datapoints
    const energyData = currentData.docs.filter((dp) => {
      const metricKey = dp.metricKey;
      return metricKey.includes("electricity") || metricKey.includes("energy");
    });
    if (energyData.length > 0) {
      const totalEnergy = energyData.reduce((sum, dp) => sum + (dp.value ?? 0), 0);
      const renewableEnergy = energyData
        .filter((dp) => dp.metricKey.includes("renewable"))
        .reduce((sum, dp) => sum + (dp.value ?? 0), 0);
      currentMetrics.renewable_percentage =
        totalEnergy > 0 ? (renewableEnergy / totalEnergy) * 100 : 0;
    }

    // Fetch previous period metrics (if provided)
    const previousMetrics: Record<string, number> = {
      total_emissions: 0,
      scope1_emissions: 0,
      scope2_emissions: 0,
      scope3_emissions: 0,
      renewable_percentage: 0,
      emissions_intensity: 0,
      waste_diversion: 0,
    };

    if (previousPeriodId) {
      const previousData = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { period: { equals: previousPeriodId } },
          ],
        },
        limit: 10000,
        overrideAccess: true,
      });

      accumulateScopeMetrics(previousData.docs, previousMetrics);

      previousMetrics.total_emissions =
        (previousMetrics.scope1_emissions ?? 0) +
        (previousMetrics.scope2_emissions ?? 0) +
        (previousMetrics.scope3_emissions ?? 0);
    }

    // Build dashboard
    const dashboard = buildExecutiveDashboard(currentMetrics, previousMetrics);

    return NextResponse.json({
      dashboard,
      periods: periods.docs.map((p) => ({
        id: p.id,
        year: new Date(p.startDate).getFullYear(),
      })),
      currentPeriodId: periodId,
      previousPeriodId: previousPeriodId || null,
    });
  } catch (error) {
    console.error("Executive dashboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      periodId: string;
      previousPeriodId?: string;
    };

    // Forward to GET
    const url = new URL("/api/app/analytics/executive-dashboard", req.url);
    url.searchParams.append("periodId", body.periodId);
    if (body.previousPeriodId) {
      url.searchParams.append("previousPeriodId", body.previousPeriodId);
    }

    return GET(new Request(url));
  } catch (error) {
    console.error("Executive dashboard POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
