import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  comparisonToCsv,
  isCompareType,
  resolvePresetYears,
  type CompareType,
  type ComparisonResult,
} from "@/lib/analytics/compare";
import {
  findPeriodById,
  findPeriodByYear,
  loadOrgPeriods,
  runGroupedCompare,
  runMultiPeriodCompare,
  runYoYCompare,
  type ReportingPeriodDoc,
} from "@/lib/analytics/compareLoad";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type CompareBody = {
  type?: unknown;
  period1?: unknown;
  period2?: unknown;
  periods?: unknown;
  year1?: unknown;
  year2?: unknown;
  metricKey?: unknown;
  presetId?: unknown;
  exportCsv?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

function resolveTwoPeriods(
  docs: ReportingPeriodDoc[],
  body: CompareBody,
): { baseline: ReportingPeriodDoc; current: ReportingPeriodDoc } | { error: string } {
  const period1 = asString(body.period1);
  const period2 = asString(body.period2);
  const year1 = asNumber(body.year1);
  const year2 = asNumber(body.year2);

  let baseline: ReportingPeriodDoc | null = null;
  let current: ReportingPeriodDoc | null = null;

  if (period1 && period2) {
    baseline = findPeriodById(docs, period1);
    current = findPeriodById(docs, period2);
  } else if (year1 != null && year2 != null) {
    baseline = findPeriodByYear(docs, year1);
    current = findPeriodByYear(docs, year2);
  }

  if (!baseline || !current) {
    return {
      error:
        "Provide period1 and period2 (reporting period ids) or year1 and year2 matching org periods.",
    };
  }
  return { baseline, current };
}

/**
 * GET /api/app/analytics/compare
 * Lists org reporting periods for the comparison picker.
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
    });
  } catch (error) {
    console.error("Analytics compare periods error:", error);
    return NextResponse.json({ error: "Failed to load periods" }, { status: 500 });
  }
}

/**
 * POST /api/app/analytics/compare
 * Body: { type, period1, period2 | year1, year2 | periods[], metricKey?, presetId?, exportCsv? }
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CompareBody;
  try {
    body = (await req.json()) as CompareBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let type: CompareType | null = isCompareType(body.type) ? body.type : null;
  const presetId = asString(body.presetId);

  if (presetId && !type) {
    const years = resolvePresetYears(presetId);
    if (years) {
      type = "yoy";
      body = { ...body, year1: years.baselineYear, year2: years.currentYear };
    }
  }

  if (!type) {
    return NextResponse.json(
      {
        error: `type must be one of: yoy, by_department, by_supplier, by_metric, multi_period`,
      },
      { status: 400 },
    );
  }

  try {
    const payload = await getPayload({ config });
    const periods = await loadOrgPeriods(payload, ctx.activeOrg.id);

    if (periods.length === 0) {
      return NextResponse.json(
        { error: "No reporting periods found for this organisation." },
        { status: 404 },
      );
    }

    let comparison: ComparisonResult;

    if (type === "multi_period") {
      const ids = asStringArray(body.periods);
      let selected: ReportingPeriodDoc[];
      if (ids.length >= 2) {
        selected = ids
          .map((id) => findPeriodById(periods, id))
          .filter((p): p is ReportingPeriodDoc => p !== null);
        if (selected.length < 2) {
          return NextResponse.json(
            { error: "periods must include at least two valid period ids." },
            { status: 400 },
          );
        }
      } else {
        // Default: up to 4 most recent periods, chronological
        selected = [...periods].slice(0, 4).reverse();
        if (selected.length < 2) {
          return NextResponse.json(
            { error: "Need at least two reporting periods for multi-period compare." },
            { status: 400 },
          );
        }
      }
      comparison = await runMultiPeriodCompare(payload, ctx.activeOrg.id, selected);
    } else if (type === "yoy") {
      if (presetId) {
        const years = resolvePresetYears(presetId);
        if (years) {
          body = { ...body, year1: years.baselineYear, year2: years.currentYear };
        }
      }
      const resolved = resolveTwoPeriods(periods, body);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      comparison = await runYoYCompare(
        payload,
        ctx.activeOrg.id,
        resolved.baseline,
        resolved.current,
      );
    } else {
      const resolved = resolveTwoPeriods(periods, body);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      comparison = await runGroupedCompare(
        payload,
        ctx.activeOrg.id,
        type,
        resolved.baseline,
        resolved.current,
        asString(body.metricKey),
      );
    }

    if (body.exportCsv === true) {
      const csv = comparisonToCsv(comparison);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="compare-${type}.csv"`,
        },
      });
    }

    return NextResponse.json({
      comparison,
      links: {
        benchmarks: "/benchmarks",
        scenarios: "/analytics?tab=scenarios",
        tcfd: "/tcfd",
        rootCause: "/analytics/root-cause",
      },
    });
  } catch (error) {
    console.error("Analytics compare error:", error);
    return NextResponse.json({ error: "Failed to run comparison" }, { status: 500 });
  }
}
