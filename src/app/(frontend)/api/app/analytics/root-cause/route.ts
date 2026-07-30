import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  performRootCauseAnalysis,
  exportRootCauseAnalysis,
} from "@/lib/analytics/rootCauseAnalysis";
import type { Datapoint } from "@/payload-types";

function supplierIdFrom(dp: Datapoint): string {
  if (typeof dp.supplier === "object" && dp.supplier !== null) {
    return dp.supplier.id;
  }
  if (typeof dp.supplier === "string" && dp.supplier.length > 0) {
    return dp.supplier;
  }
  return "Unknown";
}

function noteMatch(dp: Datapoint, key: string, fallback: string): string {
  const note = dp.note ?? "";
  const match = note.match(new RegExp(`${key}:([^\\s]+)`));
  return match?.[1] ?? fallback;
}

function accumulateDimensions(
  docs: Datapoint[],
  metricKey: string,
  target: {
    bySupplier: Record<string, number>;
    byFacility: Record<string, number>;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
  },
): void {
  docs.forEach((dp) => {
    const supplier = supplierIdFrom(dp);
    const facility = noteMatch(dp, "facility", "Facility-1");
    const source = noteMatch(dp, "source", "Direct");
    const value = dp.value ?? 0;

    target.bySupplier[supplier] = (target.bySupplier[supplier] || 0) + value;
    target.byFacility[facility] = (target.byFacility[facility] || 0) + value;
    target.byCategory[metricKey] = (target.byCategory[metricKey] || 0) + value;
    target.bySource[source] = (target.bySource[source] || 0) + value;
  });
}

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const metricKey = url.searchParams.get("metricKey") || "derived.energy_total_mwh";
    const periodId = url.searchParams.get("periodId");
    const previousPeriodId = url.searchParams.get("previousPeriodId");
    const exportFormat = url.searchParams.get("export") as "csv" | "json" | undefined;

    const payload = await getPayload({ config });

    if (!periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 });
    }

    // Fetch current period data
    const currentData = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
          { metricKey: { equals: metricKey } },
        ],
      },
      limit: 10000,
      overrideAccess: true,
    });

    // Group by dimensions
    const current = {
      bySupplier: {} as Record<string, number>,
      byFacility: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    accumulateDimensions(currentData.docs, metricKey, current);

    // Fetch previous period data (default to current if not specified)
    const previous = {
      bySupplier: {} as Record<string, number>,
      byFacility: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    if (previousPeriodId) {
      const previousData = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { period: { equals: previousPeriodId } },
            { metricKey: { equals: metricKey } },
          ],
        },
        limit: 10000,
        overrideAccess: true,
      });

      accumulateDimensions(previousData.docs, metricKey, previous);
    }

    // Perform analysis
    const analysis = performRootCauseAnalysis(metricKey, current, previous);

    // Handle export
    if (exportFormat) {
      const exported = exportRootCauseAnalysis(analysis, exportFormat);
      const headers = new Headers({
        "Content-Type": exported.mimeType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      });

      return new NextResponse(exported.data as string, { headers });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Root cause analysis error:", error);
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
      metricKey: string;
      periodId: string;
      previousPeriodId?: string;
    };

    // Forward to GET with query parameters
    const url = new URL("/api/app/analytics/root-cause", req.url);
    url.searchParams.append("metricKey", body.metricKey);
    url.searchParams.append("periodId", body.periodId);
    if (body.previousPeriodId) {
      url.searchParams.append("previousPeriodId", body.previousPeriodId);
    }

    return GET(new Request(url));
  } catch (error) {
    console.error("Root cause POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
