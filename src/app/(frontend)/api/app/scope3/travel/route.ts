import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  BUSINESS_TRAVEL_MODES,
  computeTravelAndCommute,
  EMPLOYEE_COMMUTE_MODES,
  METRIC_KEYS,
  TRAVEL_AND_COMMUTE_METRIC_KEYS,
  type DatapointValue,
} from "@/lib/calc";
import { writeDatapoint } from "@/lib/data";
import { loadOrgEmissionFactors } from "@/lib/factors/loadEmissionFactors";
import { resolveOrgEmissionsStandard } from "@/lib/factors/standards";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

const TRAVEL_METRIC_SET = new Set<string>(TRAVEL_AND_COMMUTE_METRIC_KEYS);

const FIELD_META = [
  {
    metricKey: METRIC_KEYS.businessTravel,
    label: "Business travel (legacy aggregate)",
    unit: "km",
    group: "travel_aggregate" as const,
  },
  ...BUSINESS_TRAVEL_MODES.map((m) => ({
    metricKey: m.metricKey,
    label: m.label,
    unit: m.metricKey === METRIC_KEYS.businessTravelHotelNights ? "nights" : "km",
    group: "travel_mode" as const,
  })),
  ...EMPLOYEE_COMMUTE_MODES.map((m) => ({
    metricKey: m.metricKey,
    label: m.label,
    unit: "km",
    group: "commute" as const,
  })),
];

function periodYear(period: { startDate: string; endDate?: string | null }): number {
  return new Date(String(period.endDate ?? period.startDate)).getFullYear();
}

function parseActivityBody(body: unknown):
  | {
      periodId: string;
      activities: Array<{ metricKey: string; value: number | null }>;
    }
  | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Invalid body" };
  }
  const record = body as Record<string, unknown>;
  const periodId = typeof record.periodId === "string" ? record.periodId.trim() : "";
  if (!periodId) return { error: "periodId is required" };

  if (!Array.isArray(record.activities)) {
    return { error: "activities must be an array" };
  }

  const activities: Array<{ metricKey: string; value: number | null }> = [];
  for (const row of record.activities) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return { error: "Each activity must be an object" };
    }
    const item = row as Record<string, unknown>;
    const metricKey = typeof item.metricKey === "string" ? item.metricKey.trim() : "";
    if (!TRAVEL_METRIC_SET.has(metricKey)) {
      return { error: `Unsupported metricKey: ${metricKey || "(empty)"}` };
    }
    if (item.value === null) {
      activities.push({ metricKey, value: null });
      continue;
    }
    if (
      typeof item.value !== "number" ||
      !Number.isFinite(item.value) ||
      item.value < 0
    ) {
      return { error: `Invalid value for ${metricKey}` };
    }
    activities.push({ metricKey, value: item.value });
  }

  return { periodId, activities };
}

/**
 * GET /api/app/scope3/travel?periodId=
 * Membership-gated read of Cat 6/7 datapoints + computed tCO2e preview.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const url = new URL(request.url);
    const requestedPeriodId = url.searchParams.get("periodId");

    const periods = await payload.find({
      collection: "reporting-periods",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-endDate",
      limit: 50,
      overrideAccess: true,
    });

    if (periods.docs.length === 0) {
      return NextResponse.json({
        periods: [],
        periodId: null,
        fields: FIELD_META,
        activities: [],
        computation: null,
        message:
          "No reporting period. Create one under Metrics before entering travel data.",
      });
    }

    const period =
      (requestedPeriodId ? periods.docs.find((p) => p.id === requestedPeriodId) : null) ??
      periods.docs.find((p) => p.status === "open") ??
      periods.docs[0];

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const dps = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: period.id } },
          { metricKey: { in: [...TRAVEL_AND_COMMUTE_METRIC_KEYS] } },
        ],
      },
      limit: 100,
      overrideAccess: true,
    });

    const byKey = new Map(
      dps.docs.map((d) => [
        d.metricKey,
        {
          datapointId: d.id,
          metricKey: d.metricKey,
          value: d.value ?? null,
          quality: d.quality,
          unit: d.unit ?? null,
        },
      ]),
    );

    const activities = FIELD_META.map((field) => {
      const existing = byKey.get(field.metricKey);
      return {
        ...field,
        datapointId: existing?.datapointId ?? null,
        value: existing?.value ?? null,
        quality: existing?.quality ?? "missing",
      };
    });

    const metrics: Record<string, DatapointValue> = {};
    for (const row of activities) {
      if (row.value !== null) {
        metrics[row.metricKey] = {
          value: row.value,
          quality: row.quality === "estimated" ? "estimated" : "measured",
        };
      }
    }

    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    });
    const standard = resolveOrgEmissionsStandard(org);
    const { factors } = await loadOrgEmissionFactors(payload, {
      id: ctx.activeOrg.id,
      settings: { emissionsStandard: standard },
    });
    const region = org.country || "GB";
    const year = periodYear(period);

    let computation: ReturnType<typeof computeTravelAndCommute> | null = null;
    let computeError: string | null = null;
    try {
      computation = computeTravelAndCommute(metrics, factors, region, year);
    } catch (err) {
      computeError = err instanceof Error ? err.message : "Calculation failed";
    }

    const canEdit =
      ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";

    return NextResponse.json({
      periods: periods.docs.map((p) => ({
        id: p.id,
        label: p.label,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
      periodId: period.id,
      fields: FIELD_META,
      activities,
      canEdit,
      region,
      year,
      standard,
      computation: computation
        ? {
            totalTco2e: computation.measured.value,
            quality: computation.measured.quality,
            components: computation.components.map((c) => ({
              key: c.key,
              label: c.label,
              valueTco2e: c.valueTco2e,
              factorKey: c.factor.key,
              factorValue: c.factor.value,
              factorUnit: c.factor.unit,
            })),
            missingInputs: computation.missingInputs,
          }
        : null,
      computeError,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/app/scope3/travel
 * Body: { periodId, activities: [{ metricKey, value }] }
 * Writes Membership-gated datapoints for Cat 6/7 metrics.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseActivityBody(await request.json());
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const period = await payload.findByID({
      collection: "reporting-periods",
      id: parsed.periodId,
      depth: 0,
      overrideAccess: true,
    });
    const periodOrg =
      typeof period.organisation === "object" && period.organisation
        ? String(period.organisation.id)
        : String(period.organisation);
    if (periodOrg !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const unitByKey = new Map<string, string>(
      FIELD_META.map((f) => [f.metricKey, f.unit]),
    );
    const written: Array<{
      metricKey: string;
      datapointId: string;
      value: number | null;
    }> = [];

    for (const activity of parsed.activities) {
      const result = await writeDatapoint(payload, {
        organisationId: ctx.activeOrg.id,
        periodId: parsed.periodId,
        metricKey: activity.metricKey,
        value: activity.value,
        unit: unitByKey.get(activity.metricKey) ?? null,
        quality: activity.value === null ? "missing" : "measured",
        source: "manual",
        actorId: ctx.user.id,
        reason: "Scope 3 travel / commute entry",
      });
      written.push({
        metricKey: activity.metricKey,
        datapointId: result.id,
        value: activity.value,
      });
    }

    return NextResponse.json({ ok: true, written });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
