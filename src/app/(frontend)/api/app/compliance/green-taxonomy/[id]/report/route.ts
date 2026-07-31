import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildReportPayload,
  gapSummaryLine,
  getOrgAssessmentById,
} from "@/lib/compliance/greenTaxonomy";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/green-taxonomy/[id]/report
 * Aligned activities % + gaps + EU peer reference.
 */
export async function GET(_req: Request, ctxParams: Ctx) {
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
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctxParams.params;
    const payload = await getPayload({ config });
    const assessment = await getOrgAssessmentById(payload, ctx.activeOrg.id, id);
    if (!assessment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const report = buildReportPayload(assessment);
    return NextResponse.json({
      report,
      gapSummary: gapSummaryLine(assessment.report),
      organisationName: ctx.activeOrg.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Green taxonomy report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
