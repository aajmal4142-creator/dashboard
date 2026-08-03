import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  activityQuantitySum,
  asActivityDataRecord,
  asActivityFields,
  asEmissionsFactor,
  isScope3Category,
  relId,
} from "@/lib/scope3/activityHelpers";
import { EmissionsFactorService } from "@/lib/scope3/emissionsFactorService";
import { Scope3Validator } from "@/lib/scope3/validation";
import type { Scope3Category } from "@/lib/scope3/types";
import type { Scope3Activity, Scope3Source } from "@/payload-types";
import config from "@/payload.config";

interface ImportActivity {
  activityData: Record<string, string | number>;
}

const ACTIVITY_STATUSES = ["draft", "validated", "approved"] as const;

function isActivityStatus(value: string): value is (typeof ACTIVITY_STATUSES)[number] {
  return (ACTIVITY_STATUSES as readonly string[]).includes(value);
}

function serializeActivity(doc: Scope3Activity) {
  const source =
    typeof doc.source === "object" && doc.source !== null
      ? (doc.source as Scope3Source)
      : null;
  const period =
    typeof doc.period === "object" && doc.period !== null ? doc.period : null;
  const category = source && isScope3Category(source.type) ? source.type : null;
  const emissionsFactor = source ? asEmissionsFactor(source.emissionsFactor) : null;
  const activityDataFields = source ? asActivityFields(source.activityDataFields) : [];

  return {
    id: doc.id,
    sourceId: relId(doc.source) ?? "",
    sourceName: source?.name ?? "Unknown source",
    category,
    periodId: relId(doc.period) ?? "",
    periodLabel:
      period && "label" in period && typeof period.label === "string" ? period.label : "",
    activityData: asActivityDataRecord(doc.activityData),
    activityDataFields,
    emissionsFactor,
    calculatedEmissions: doc.calculatedEmissions,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/app/scope3/activities?periodId=&category=&sourceId=&status=&page=&limit=
 * Membership-gated list of Scope 3 activity records (CSV-imported / generic).
 */
export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const requestedPeriodId = url.searchParams.get("periodId");
    const categoryParam = url.searchParams.get("category");
    const sourceId = url.searchParams.get("sourceId");
    const statusParam = url.searchParams.get("status");

    const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
    if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 200) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
    }
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    if (!Number.isInteger(pageParam) || pageParam < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }

    if (categoryParam && !isScope3Category(categoryParam)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (statusParam && !isActivityStatus(statusParam)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const payload = await getPayload({ config });

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
        sources: [],
        activities: [],
        pagination: { page: 1, limit: limitParam, totalDocs: 0, totalPages: 0 },
        canEdit: false,
        message:
          "No reporting period. Create one under Metrics before managing activity records.",
      });
    }

    const period =
      (requestedPeriodId ? periods.docs.find((p) => p.id === requestedPeriodId) : null) ??
      periods.docs.find((p) => p.status === "open") ??
      periods.docs[0];

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const sourcesResult = await payload.find({
      collection: "scope3-sources",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 500,
      sort: "name",
      overrideAccess: true,
    });

    let sourceIdsForCategory: string[] | null = null;
    if (categoryParam) {
      sourceIdsForCategory = sourcesResult.docs
        .filter((s) => s.type === categoryParam)
        .map((s) => s.id);
      if (sourceIdsForCategory.length === 0) {
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
          sources: sourcesResult.docs.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type as Scope3Category,
            emissionsFactor: asEmissionsFactor(s.emissionsFactor),
            activityDataFields: asActivityFields(s.activityDataFields),
          })),
          activities: [],
          pagination: {
            page: pageParam,
            limit: limitParam,
            totalDocs: 0,
            totalPages: 0,
          },
          canEdit,
        });
      }
    }

    const whereAnd: Where[] = [
      { organisation: { equals: ctx.activeOrg.id } },
      { period: { equals: period.id } },
    ];

    if (sourceId) {
      whereAnd.push({ source: { equals: sourceId } });
    } else if (sourceIdsForCategory) {
      whereAnd.push({ source: { in: sourceIdsForCategory } });
    }

    if (statusParam) {
      whereAnd.push({ status: { equals: statusParam } });
    }

    const result = await payload.find({
      collection: "scope3-activities",
      where: { and: whereAnd },
      limit: limitParam,
      page: pageParam,
      sort: "-updatedAt",
      depth: 1,
      overrideAccess: true,
    });

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
      sources: sourcesResult.docs.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as Scope3Category,
        emissionsFactor: asEmissionsFactor(s.emissionsFactor),
        activityDataFields: asActivityFields(s.activityDataFields),
      })),
      activities: (result.docs as Scope3Activity[]).map(serializeActivity),
      pagination: {
        page: result.page ?? pageParam,
        limit: limitParam,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
      },
      canEdit,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
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

  const body = (await req.json()) as {
    sourceId?: string;
    periodId?: string;
    activities?: ImportActivity[];
    dryRun?: boolean;
  };

  const { sourceId, periodId, activities = [], dryRun = false } = body;

  if (!sourceId || !periodId) {
    return NextResponse.json(
      { error: "sourceId and periodId required" },
      { status: 400 },
    );
  }

  if (!Array.isArray(activities) || activities.length === 0) {
    return NextResponse.json(
      { error: "At least one activity required" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });

  const source = await payload.findByID({
    collection: "scope3-sources",
    id: sourceId,
    overrideAccess: true,
  });

  const organisationId =
    typeof source.organisation === "object"
      ? source.organisation.id
      : source.organisation;
  if (organisationId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const activityDataFields = asActivityFields(source.activityDataFields);
  const emissionsFactor = asEmissionsFactor(source.emissionsFactor);
  if (!emissionsFactor) {
    return NextResponse.json(
      { error: "Source emissions factor is invalid" },
      { status: 400 },
    );
  }

  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    overrideAccess: true,
  });

  const periodOrgId =
    typeof period.organisation === "object"
      ? period.organisation.id
      : period.organisation;
  if (periodOrgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  const validator = new Scope3Validator();
  const factorService = new EmissionsFactorService({
    factors: [],
    standard: "GHGProtocol2004",
  });

  const errors: Array<{ row: number; error: string }> = [];
  const imported: Array<{ id: string; emissions: number }> = [];

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const validation = await validator.validateActivity(
      activity.activityData,
      activityDataFields,
    );

    if (!validation.valid) {
      errors.push({
        row: i,
        error: validation.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
      });
      continue;
    }

    const activityValues = Object.values(validation.normalizedData || {});
    if (activityValues.length === 0) continue;

    const activityValue = activityQuantitySum(validation.normalizedData ?? {});
    const emissions = factorService.calculateEmissions(activityValue, emissionsFactor);

    if (!dryRun) {
      try {
        const doc = await payload.create({
          collection: "scope3-activities",
          data: {
            organisation: ctx.activeOrg.id,
            source: sourceId,
            period: periodId,
            activityData: validation.normalizedData ?? {},
            calculatedEmissions: emissions,
            status: "draft",
            enteredBy: ctx.user.id,
          },
          overrideAccess: true,
        });

        imported.push({
          id: doc.id,
          emissions,
        });
      } catch (error) {
        errors.push({
          row: i,
          error: `Failed to create: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    } else {
      imported.push({
        id: `dry-run-${i}`,
        emissions,
      });
    }
  }

  return NextResponse.json({
    imported: imported.length,
    errors,
    calculations: {
      activities: imported,
    },
  });
}
