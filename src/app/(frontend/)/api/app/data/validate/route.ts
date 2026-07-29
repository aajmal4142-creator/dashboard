import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import {
  validateDatapoint,
  validateBatch,
  type DatapointRecord,
} from "@/lib/data/validationEngine";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * POST /api/app/data/validate
 * Validate datapoint(s) against organization's quality rules
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
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body: unknown = await request.json();

    // Support single datapoint or batch
    const datapoints: DatapointRecord[] = Array.isArray(body)
      ? (body as DatapointRecord[])
      : [body as DatapointRecord];

    if (datapoints.length === 0) {
      return NextResponse.json({ error: "No datapoints provided" }, { status: 400 });
    }

    let results;
    if (datapoints.length === 1) {
      const result = await validateDatapoint(ctx.activeOrg.id, datapoints[0]);
      results = [result];
    } else {
      const resultMap = await validateBatch(ctx.activeOrg.id, datapoints);
      results = Array.from(resultMap.values());
    }

    // Track API usage
    await incrementApiUsage(ctx.activeOrg.id, datapoints.length);

    const passCount = results.filter((r) => r.passed).length;

    return NextResponse.json({
      summary: {
        total: datapoints.length,
        passed: passCount,
        failed: datapoints.length - passCount,
      },
      results,
    });
  } catch (error) {
    console.error("Error validating data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/app/data/validate-rules
 * Get validation rules for the organization
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    const rules = await payload.find({
      collection: "data-quality-rules",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
    });

    // Track API usage
    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      total: rules.totalDocs,
      rules: rules.docs.map((r) => ({
        id: r.id,
        name: r.ruleName,
        type: r.ruleType,
        priority: r.priority,
        status: r.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching validation rules:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
