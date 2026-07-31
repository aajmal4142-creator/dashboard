import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { resolveOrgBaselineByScope } from "@/lib/analytics/resolveOrgBaseline";
import {
  INTENSITY_TYPES,
  compareIntensityToMedian,
  intensityBenchmarkMetricKey,
  resolveIntensityForType,
  type EmissionsIntensityResult,
  type IntensityDenominators,
  type IntensityPeerStatus,
  type IntensityType,
} from "@/lib/analytics/consumptionIntensity";
import { findMatchingPeerGroup } from "@/lib/benchmarks/lookup";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";
import { MIN_COHORT_SIZE } from "@/lib/benchmarks";
import config from "@/payload.config";

const REVENUE_BAND_MIDPOINTS: Record<string, number> = {
  lt_2m: 1_000_000,
  "2_10m": 6_000_000,
  "10_50m": 30_000_000,
  "50_250m": 150_000_000,
  gt_250m: 250_000_000,
};

type IntensityTypeResponse = {
  type: IntensityType;
  current: EmissionsIntensityResult;
  previous_year: EmissionsIntensityResult | null;
  changePercent: number | null;
  benchmarkMedian: number | null;
  status: IntensityPeerStatus;
};

function isIntensityType(value: string): value is IntensityType {
  return (INTENSITY_TYPES as ReadonlyArray<string>).includes(value);
}

function periodYear(period: { startDate: string; endDate?: string | null }): number {
  return new Date(String(period.endDate ?? period.startDate)).getFullYear();
}

function resolveDenominators(org: {
  annualRevenue?: number | null;
  employeeCount?: number | null;
  annualOutputUnits?: number | null;
  outputUnitLabel?: string | null;
  floorAreaSqm?: number | null;
  revenueBand?: string | null;
}): IntensityDenominators {
  const fromBand =
    org.revenueBand && REVENUE_BAND_MIDPOINTS[org.revenueBand]
      ? REVENUE_BAND_MIDPOINTS[org.revenueBand]
      : null;
  return {
    annualRevenue: org.annualRevenue ?? fromBand,
    employeeCount: org.employeeCount ?? null,
    annualOutputUnits: org.annualOutputUnits ?? null,
    outputUnitLabel: org.outputUnitLabel ?? null,
    floorAreaSqm: org.floorAreaSqm ?? null,
  };
}

async function loadPeerMedian(
  payload: Awaited<ReturnType<typeof getPayload>>,
  org: {
    id: string;
    sector: string;
    revenueBand?: string | null;
    country: string;
    benchmarkOptOut?: boolean | null;
  },
  type: IntensityType,
): Promise<number | null> {
  if (!mayPublishBenchmarkCohorts() || org.benchmarkOptOut) return null;

  const match = await findMatchingPeerGroup(
    payload,
    {
      sector: org.sector,
      revenueBand: org.revenueBand,
      country: org.country,
    },
    { metricKey: intensityBenchmarkMetricKey(type) },
  );

  if (!match || match.row.cohortSize < MIN_COHORT_SIZE) return null;
  return match.row.p50 ?? null;
}

function buildTypeResponse(
  type: IntensityType,
  currentEmissions: number,
  previousEmissions: number | null,
  denominators: IntensityDenominators,
  benchmarkMedian: number | null,
): IntensityTypeResponse {
  const previous =
    previousEmissions != null
      ? resolveIntensityForType(type, previousEmissions, denominators)
      : null;

  const current = resolveIntensityForType(
    type,
    currentEmissions,
    denominators,
    previous?.value ?? null,
  );

  return {
    type,
    current,
    previous_year: previous,
    changePercent: current.changePercent,
    benchmarkMedian,
    status: compareIntensityToMedian(current.value, benchmarkMedian),
  };
}

/**
 * GET /api/app/analytics/intensity?period=2026&type=per_revenue
 * Membership via getCurrentContext(); never trust org cookie alone.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const typeParam = url.searchParams.get("type");

    if (typeParam && !isIntensityType(typeParam)) {
      return NextResponse.json(
        {
          error: `Invalid type. Expected one of: ${INTENSITY_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const orgId = ctx.activeOrg.id as string;

    const periods = await payload.find({
      collection: "reporting-periods",
      where: { organisation: { equals: orgId } },
      sort: "-startDate",
      limit: 20,
      overrideAccess: true,
    });

    if (periods.docs.length === 0) {
      return NextResponse.json({ error: "No reporting periods found" }, { status: 404 });
    }

    const requestedYear = periodParam ? Number.parseInt(periodParam, 10) : null;
    const currentPeriod =
      requestedYear && Number.isFinite(requestedYear)
        ? periods.docs.find((p) => periodYear(p) === requestedYear)
        : periods.docs[0];

    if (!currentPeriod) {
      return NextResponse.json(
        { error: `No reporting period found for year ${periodParam}` },
        { status: 404 },
      );
    }

    const year = periodYear(currentPeriod);
    const previousYear = year - 1;

    const org = await payload.findByID({
      collection: "organisations",
      id: orgId,
      depth: 0,
      overrideAccess: true,
    });

    const denominators = resolveDenominators(org);

    const currentBaseline = await resolveOrgBaselineByScope(payload, orgId, year);
    const previousBaseline = await resolveOrgBaselineByScope(
      payload,
      orgId,
      previousYear,
    );

    const currentEmissions =
      currentBaseline.baseline.scope1 +
      currentBaseline.baseline.scope2 +
      currentBaseline.baseline.scope3;

    const previousEmissions =
      previousBaseline.quality === "calculated"
        ? previousBaseline.baseline.scope1 +
          previousBaseline.baseline.scope2 +
          previousBaseline.baseline.scope3
        : null;

    const typesToCompute: IntensityType[] =
      typeParam && isIntensityType(typeParam) ? [typeParam] : [...INTENSITY_TYPES];

    const typeResults: IntensityTypeResponse[] = [];
    for (const type of typesToCompute) {
      const benchmarkMedian = await loadPeerMedian(
        payload,
        {
          id: orgId,
          sector: org.sector,
          revenueBand: org.revenueBand,
          country: org.country,
          benchmarkOptOut: org.benchmarkOptOut,
        },
        type,
      );
      typeResults.push(
        buildTypeResponse(
          type,
          currentEmissions,
          previousEmissions,
          denominators,
          benchmarkMedian,
        ),
      );
    }

    const base = {
      period: year,
      previousPeriod: previousYear,
      totalEmissions: currentEmissions,
      previousTotalEmissions: previousEmissions,
      emissionsQuality: currentBaseline.quality,
      emissionsMessage: currentBaseline.message ?? null,
      denominators: {
        annualRevenue: denominators.annualRevenue,
        employeeCount: denominators.employeeCount,
        annualOutputUnits: denominators.annualOutputUnits,
        outputUnitLabel: denominators.outputUnitLabel,
        floorAreaSqm: denominators.floorAreaSqm,
      },
    };

    if (typeParam) {
      const single = typeResults[0]!;
      return NextResponse.json({
        ...base,
        type: single.type,
        current: single.current,
        previous_year: single.previous_year,
        changePercent: single.changePercent,
        benchmarkMedian: single.benchmarkMedian,
        status: single.status,
      });
    }

    const byType = Object.fromEntries(
      typeResults.map((row) => [row.type, row]),
    ) as Record<IntensityType, IntensityTypeResponse>;

    return NextResponse.json({
      ...base,
      types: byType,
    });
  } catch (error) {
    console.error("Intensity calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate intensity" }, { status: 500 });
  }
}
