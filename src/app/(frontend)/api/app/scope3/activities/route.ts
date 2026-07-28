import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { Scope3Validator } from "@/lib/scope3/validation";
import { EmissionsFactorService } from "@/lib/scope3/emissionsFactorService";
import type { ActivityDataField, EmissionsFactor } from "@/lib/scope3/types";
import config from "@/payload.config";

interface ImportActivity {
  activityData: Record<string, string | number>;
}

function asActivityFields(value: unknown): ActivityDataField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (field): field is ActivityDataField =>
      typeof field === "object" &&
      field !== null &&
      "name" in field &&
      "unit" in field &&
      "required" in field,
  );
}

function asEmissionsFactor(value: unknown): EmissionsFactor | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const factor = value as Record<string, unknown>;
  if (typeof factor.value !== "number" || typeof factor.unit !== "string") {
    return null;
  }
  return {
    value: factor.value,
    unit: factor.unit,
    source: typeof factor.source === "string" ? factor.source : "Custom",
    year: typeof factor.year === "number" ? factor.year : new Date().getFullYear(),
    confidence:
      factor.confidence === "high" ||
      factor.confidence === "medium" ||
      factor.confidence === "low"
        ? factor.confidence
        : "medium",
  };
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

  // Fetch source
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

  // Fetch period
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

  // Validate and process activities
  const validator = new Scope3Validator();
  const factorService = new EmissionsFactorService();

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

    // Calculate emissions
    const activityValues = Object.values(validation.normalizedData || {});
    if (activityValues.length === 0) continue;

    const activityValue = activityValues.reduce((a, b) => a + b, 0);
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
