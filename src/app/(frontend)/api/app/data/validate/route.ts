import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  validateBatch,
  validateDatapoint,
  type DatapointRecord,
} from "@/lib/data/validationEngine";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * POST /api/app/data/validate
 * Validate datapoint(s) against organization's quality rules.
 * Returns errors (block approval) and warnings separately.
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

    const datapoints: DatapointRecord[] = Array.isArray(body)
      ? (body as DatapointRecord[])
      : body &&
          typeof body === "object" &&
          "datapointData" in body &&
          (body as { datapointData: unknown }).datapointData &&
          typeof (body as { datapointData: unknown }).datapointData === "object"
        ? [(body as { datapointData: DatapointRecord }).datapointData]
        : [body as DatapointRecord];

    if (datapoints.length === 0) {
      return NextResponse.json({ error: "No datapoints provided" }, { status: 400 });
    }

    let results;
    if (datapoints.length === 1) {
      const result = await validateDatapoint(ctx.activeOrg.id, datapoints[0]);
      results = [{ datapointId: datapoints[0].id ?? null, ...result }];
    } else {
      const resultMap = await validateBatch(ctx.activeOrg.id, datapoints);
      results = Array.from(resultMap.entries()).map(([key, result]) => ({
        datapointId: key,
        ...result,
      }));
    }

    await incrementApiUsage(ctx.activeOrg.id, datapoints.length);

    const passCount = results.filter((r) => r.passed).length;
    const blockCount = results.filter((r) => !r.canApprove).length;

    return NextResponse.json({
      summary: {
        total: datapoints.length,
        passed: passCount,
        failed: datapoints.length - passCount,
        blocked: blockCount,
      },
      results,
      // Sprint-shaped single-datapoint convenience fields
      ...(results.length === 1
        ? {
            valid: results[0].passed,
            canApprove: results[0].canApprove,
            errors: results[0].errors,
            warnings: results[0].warnings,
          }
        : {}),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error validating data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
