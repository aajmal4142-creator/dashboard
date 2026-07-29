import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  calculateIntensityMetrics,
  generateIntensityReport,
} from "@/lib/analytics/consumptionIntensity";

const REVENUE_BAND_MIDPOINTS: Record<string, number> = {
  lt_2m: 1_000_000,
  "2_10m": 6_000_000,
  "10_50m": 30_000_000,
  "50_250m": 150_000_000,
  gt_250m: 250_000_000,
};

/**
 * GET /api/app/analytics/intensity
 * Calculate consumption intensity metrics
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });

    // Fetch reporting periods for this org
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      sort: "-year",
      limit: 5,
    });

    if (periods.docs.length === 0) {
      return NextResponse.json({ error: "No reporting periods found" }, { status: 404 });
    }

    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id as string,
    });

    const revenue = (org.revenueBand && REVENUE_BAND_MIDPOINTS[org.revenueBand]) || 0;
    const employees = org.employeeCount || 0;

    // Collect data for each period
    const yearlyData: Array<{
      year: number;
      emissions: number;
      revenue: number;
      employees: number;
      productionUnits?: number;
    }> = [];

    for (const period of periods.docs) {
      // Sum emissions from datapoint values (activity / tCO2e inputs for the period)
      const datapoints = await payload.find({
        collection: "datapoints",
        where: {
          period: { equals: period.id },
        },
        limit: 10000,
      });

      const totalEmissions = datapoints.docs.reduce(
        (sum, dp) => sum + (typeof dp.value === "number" ? dp.value : 0),
        0,
      );

      const periodYear = new Date(period.startDate).getFullYear();

      yearlyData.push({
        year: periodYear || new Date().getFullYear(),
        emissions: totalEmissions,
        revenue,
        employees,
      });
    }

    // Sort by year ascending
    yearlyData.sort((a, b) => a.year - b.year);

    // Calculate intensity metrics
    const metrics = calculateIntensityMetrics(yearlyData);

    // Generate report
    const report = generateIntensityReport(metrics);

    return NextResponse.json({
      metrics,
      report,
      yearlyData,
    });
  } catch (error) {
    console.error("Intensity calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate intensity" }, { status: 500 });
  }
}
