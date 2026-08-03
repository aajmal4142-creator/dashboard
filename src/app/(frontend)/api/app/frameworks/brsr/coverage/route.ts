import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  computeBrsrCoverage,
  type BrsrDatapointInput,
} from "@/lib/frameworks/brsr";
import { ensureOpenPeriod } from "@/lib/org/period";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function evidenceIdsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.length > 0) return [item];
    if (typeof item === "object" && item !== null && "id" in item) {
      const id = (item as { id: unknown }).id;
      if (typeof id === "string" && id.length > 0) return [id];
    }
    return [];
  });
}

function asQuality(
  value: unknown,
): BrsrDatapointInput["quality"] {
  if (
    value === "measured" ||
    value === "calculated" ||
    value === "estimated" ||
    value === "missing"
  ) {
    return value;
  }
  return "missing";
}

function asProvenance(
  value: unknown,
): BrsrDatapointInput["provenance"] {
  if (
    value === "supplier_primary" ||
    value === "spend_estimate" ||
    value === "manual"
  ) {
    return value;
  }
  return null;
}

/**
 * GET /api/app/frameworks/brsr/coverage?periodId=
 * Deterministic BRSR Core vs Comprehensive coverage for the active org.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const periodId =
      typeof params.periodId === "string" && params.periodId.length > 0
        ? params.periodId
        : await ensureOpenPeriod(
            ctx.activeOrg.id,
            ctx.activeOrg.plan,
            ctx.activeOrg.subscriptionStatus,
          );

    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    });
    const periodOrg =
      typeof period.organisation === "string"
        ? period.organisation
        : period.organisation?.id;
    if (periodOrg !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Period not in organisation" }, { status: 403 });
    }

    const datapoints = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
        ],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });

    const inputs: BrsrDatapointInput[] = datapoints.docs.map((doc) => ({
      metricKey: String(doc.metricKey),
      quality: asQuality(doc.quality),
      provenance: asProvenance(doc.provenance),
      evidenceIds: evidenceIdsOf(doc.evidence),
    }));

    const coverage = computeBrsrCoverage({
      periodId,
      datapoints: inputs,
    });

    const periodLabel =
      typeof period.label === "string" ? period.label : periodId;

    return NextResponse.json({
      success: true,
      periodLabel,
      coverage,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("BRSR coverage error:", error);
    return NextResponse.json({ error: "Failed to compute BRSR coverage" }, { status: 500 });
  }
}
