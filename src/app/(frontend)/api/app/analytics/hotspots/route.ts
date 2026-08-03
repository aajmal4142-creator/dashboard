import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  hotspotsToCsv,
  isHotspotDimension,
  isHotspotSortMode,
  type HotspotDimension,
  type HotspotSortMode,
} from "@/lib/analytics/hotspots";
import {
  findPeriodById,
  loadOrgPeriods,
  runHotspotsAnalysis,
} from "@/lib/analytics/hotspotsLoad";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type HotspotsBody = {
  dimension?: unknown;
  periodId?: unknown;
  baselinePeriodId?: unknown;
  sortBy?: unknown;
  limit?: unknown;
  exportCsv?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
}

/**
 * GET /api/app/analytics/hotspots
 * Lists org reporting periods for the hotspot period picker.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });
    const periods = await loadOrgPeriods(payload, ctx.activeOrg.id);
    return NextResponse.json({
      periods: periods.map((p) => ({
        id: p.id,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        year: new Date(String(p.endDate)).getFullYear(),
      })),
      dimensions: ["facility", "supplier", "category", "metricKey"],
    });
  } catch (error) {
    console.error("Analytics hotspots periods error:", error);
    return NextResponse.json({ error: "Failed to load periods" }, { status: 500 });
  }
}

/**
 * POST /api/app/analytics/hotspots
 * Body: { dimension, periodId, baselinePeriodId?, sortBy?, limit?, exportCsv? }
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: HotspotsBody;
  try {
    body = (await req.json()) as HotspotsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isHotspotDimension(body.dimension)) {
    return NextResponse.json(
      {
        error: "dimension must be one of: facility, supplier, category, metricKey",
      },
      { status: 400 },
    );
  }

  const dimension: HotspotDimension = body.dimension;
  const periodId = asString(body.periodId);
  if (!periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
  }

  const sortBy: HotspotSortMode | undefined = isHotspotSortMode(body.sortBy)
    ? body.sortBy
    : undefined;
  const limit = asPositiveInt(body.limit) ?? undefined;
  const baselinePeriodId = asString(body.baselinePeriodId);

  try {
    const payload = await getPayload({ config });
    const periods = await loadOrgPeriods(payload, ctx.activeOrg.id);

    if (periods.length === 0) {
      return NextResponse.json(
        { error: "No reporting periods found for this organisation." },
        { status: 404 },
      );
    }

    const period = findPeriodById(periods, periodId);
    if (!period) {
      return NextResponse.json(
        { error: "periodId does not match an organisation reporting period." },
        { status: 400 },
      );
    }

    let baselinePeriod = null;
    if (baselinePeriodId) {
      baselinePeriod = findPeriodById(periods, baselinePeriodId);
      if (!baselinePeriod) {
        return NextResponse.json(
          {
            error: "baselinePeriodId does not match an organisation reporting period.",
          },
          { status: 400 },
        );
      }
    }

    const hotspots = await runHotspotsAnalysis(payload, ctx.activeOrg.id, {
      dimension,
      period,
      baselinePeriod,
      sortBy,
      limit,
    });

    if (body.exportCsv === true) {
      const csv = hotspotsToCsv(hotspots);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="hotspots-${dimension}.csv"`,
        },
      });
    }

    return NextResponse.json({
      hotspots,
      links: {
        compare: "/analytics/compare",
        facilities: "/facilities",
        rootCause: "/analytics/root-cause",
      },
    });
  } catch (error) {
    console.error("Analytics hotspots error:", error);
    return NextResponse.json(
      { error: "Failed to run hotspot analysis" },
      { status: 500 },
    );
  }
}
