import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  evaluateRules,
  orgIdFromDoc,
  toEvaluableRule,
  type ValidationViolation,
} from "@/lib/data/validation";
import { datapointDocToRecord } from "@/lib/data/validationEngine";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ ruleId: string }> };

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const ERROR_SAMPLE = 50;

/**
 * POST /api/app/validation-rules/[ruleId]/apply
 * Apply a rule retroactively against existing organisation datapoints.
 */
export async function POST(request: Request, { params }: RouteParams) {
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

    const { ruleId } = await params;
    const payload = await getPayload({ config });

    const rule = await payload.findByID({
      collection: "data-quality-rules",
      id: ruleId,
      depth: 0,
      overrideAccess: true,
    });
    if (orgIdFromDoc(rule) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let limit = DEFAULT_LIMIT;
    try {
      const body: unknown = await request.json();
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const raw = (body as { limit?: unknown }).limit;
        if (typeof raw === "number" && Number.isFinite(raw)) {
          limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw)));
        }
      }
    } catch {
      // empty body is fine
    }

    const datapoints = await payload.find({
      collection: "datapoints",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit,
      depth: 0,
      overrideAccess: true,
    });

    const evaluable = toEvaluableRule(rule);
    let passed = 0;
    let failed = 0;
    const errors: Array<{
      datapointId: string;
      metricKey: string | null;
      violations: ValidationViolation[];
    }> = [];

    for (const doc of datapoints.docs) {
      const record = datapointDocToRecord(doc);
      const result = evaluateRules([evaluable], record);
      if (result.passed) {
        passed += 1;
      } else {
        failed += 1;
        if (errors.length < ERROR_SAMPLE) {
          errors.push({
            datapointId: doc.id,
            metricKey: doc.metricKey ?? null,
            violations: result.violations,
          });
        }
      }
    }

    await payload.update({
      collection: "data-quality-rules",
      id: rule.id,
      data: { violationCount: failed },
      overrideAccess: true,
    });

    return NextResponse.json({
      ruleId: rule.id,
      validated: datapoints.docs.length,
      passed,
      failed,
      truncated: datapoints.totalDocs > datapoints.docs.length,
      totalDatapoints: datapoints.totalDocs,
      errors,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error applying validation rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
