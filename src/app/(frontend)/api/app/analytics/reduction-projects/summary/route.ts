import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildReductionSummary,
  listOrgReductionProjects,
} from "@/lib/analytics/reduction";
import config from "@/payload.config";

/**
 * GET /api/app/analytics/reduction-projects/summary
 * Planned vs actual totals. Missing actuals are never silent zeros.
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const projects = await listOrgReductionProjects(payload, ctx.activeOrg.id);
    const summary = buildReductionSummary(projects);

    return NextResponse.json({ summary, total: projects.length });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reduction projects summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
