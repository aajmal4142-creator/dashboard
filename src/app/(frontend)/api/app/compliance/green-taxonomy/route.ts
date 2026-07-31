import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  createAssessment,
  listOrgAssessments,
  searchNaceCodes,
  TAXONOMY_OBJECTIVES,
} from "@/lib/compliance/greenTaxonomy";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/green-taxonomy
 * List assessments for active org + NACE search (?q=) + framework catalog.
 *
 * POST — start a new assessment (requires naceCode).
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
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const catalog = url.searchParams.get("catalog") === "true";

    if (q !== null || catalog) {
      return NextResponse.json({
        naceCodes: searchNaceCodes(q ?? "", 50),
        objectives: TAXONOMY_OBJECTIVES.map((o) => ({
          id: o.id,
          label: o.label,
          shortLabel: o.shortLabel,
          description: o.description,
          criteriaCount: o.criteria.length,
          dnshCount: o.dnsh.length,
          criteria: o.criteria,
          dnsh: o.dnsh,
        })),
      });
    }

    const payload = await getPayload({ config });
    const assessments = await listOrgAssessments(payload, ctx.activeOrg.id);

    return NextResponse.json({
      assessments,
      total: assessments.length,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Green taxonomy list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as {
      naceCode?: string;
      periodId?: string | null;
      applyNaceSuggestions?: boolean;
    };

    if (typeof body.naceCode !== "string" || !body.naceCode.trim()) {
      return NextResponse.json(
        { error: "naceCode is required (select from the NACE Rev. 2 catalog)" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    try {
      const assessment = await createAssessment(payload, {
        organisationId: ctx.activeOrg.id,
        naceCode: body.naceCode.trim(),
        periodId: body.periodId ?? null,
        applyNaceSuggestions: body.applyNaceSuggestions !== false,
      });
      return NextResponse.json({ assessment }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Green taxonomy create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
