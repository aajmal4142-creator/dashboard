import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  getOrgAssessmentById,
  GreenTaxonomyPdfDocument,
} from "@/lib/compliance/greenTaxonomy";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/green-taxonomy/[id]/pdf
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
      "export",
      "report",
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

    const buffer = await renderToBuffer(
      <GreenTaxonomyPdfDocument
        organisationName={ctx.activeOrg.name}
        assessmentId={assessment.id}
        status={assessment.status}
        report={assessment.report}
        generatedAt={new Date().toISOString().slice(0, 10)}
      />,
    );

    const filename = `green-taxonomy-${assessment.naceCode}-${assessment.id.slice(0, 8)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Green taxonomy PDF error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
