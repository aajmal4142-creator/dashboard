import { getPayload, type CollectionSlug } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { Scope3Validator } from "@/lib/scope3/validation";
import { EmissionsFactorService } from "@/lib/scope3/emissionsFactorService";
import type { ActivityDataField, EmissionsFactor } from "@/lib/scope3/types";
import config from "@/payload.config";

const SCOPE3_SOURCES = "scope3-sources" as CollectionSlug;
const SCOPE3_ACTIVITIES = "scope3-activities" as CollectionSlug;

interface ImportActivity {
  activityData: Record<string, string | number>;
}

interface Scope3SourceDoc {
  organisation: string | { id: string };
  activityDataFields: ActivityDataField[];
  emissionsFactor: EmissionsFactor;
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
    collection: SCOPE3_SOURCES,
    id: sourceId,
    overrideAccess: true,
  });

  const sourceDoc = source as unknown as Scope3SourceDoc;
  if (!source || String(sourceDoc.organisation) !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Fetch period
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    overrideAccess: true,
  });

  if (!period || String(period.organisation) !== ctx.activeOrg.id) {
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
      sourceDoc.activityDataFields,
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
    const emissions = factorService.calculateEmissions(
      activityValue,
      sourceDoc.emissionsFactor,
    );

    if (!dryRun) {
      try {
        const doc = await payload.create({
          collection: SCOPE3_ACTIVITIES,
          data: {
            organisation: ctx.activeOrg.id,
            source: sourceId,
            period: periodId,
            activityData: validation.normalizedData,
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
