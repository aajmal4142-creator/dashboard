import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { COMPLIANCE_ASSESSMENTS_SLUG } from "@/collections/ComplianceAssessments";
import { getCurrentContext } from "@/lib/auth";
import { can, resolveEffectivePlan } from "@/lib/billing";
import {
  buildAssessmentSnapshot,
  ComplianceAssessmentPdfDocument,
  type ComplianceAssessmentSnapshot,
  type ComplianceTemplateSnapshot,
} from "@/lib/complianceTemplates";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export async function GET(_req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "export",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
  const payload = await getPayload({ config });
  let doc;
  try {
    doc = await payload.findByID({
      collection: COMPLIANCE_ASSESSMENTS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (relationId(doc.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let snapshot = doc.snapshot as ComplianceAssessmentSnapshot | null;
  if (!snapshot) {
    const templateSnapshot = doc.templateSnapshot as ComplianceTemplateSnapshot | null;
    if (!templateSnapshot) {
      return NextResponse.json(
        { error: "Assessment is missing template data for PDF export" },
        { status: 500 },
      );
    }
    snapshot = buildAssessmentSnapshot({
      organisationName: auth.activeOrg.name,
      title: doc.title,
      reportingYear: Number(doc.reportingYear),
      status: doc.status === "final" ? "final" : "draft",
      template: templateSnapshot,
      answers: doc.answers,
      calculationResults: doc.calculationResults,
      preparedBy: { id: auth.user.id, name: auth.user.email },
    });
  }

  const watermarked = !can(
    resolveEffectivePlan({
      plan: auth.activeOrg.plan,
      subscriptionStatus: auth.activeOrg.subscriptionStatus,
    }),
    "unwatermarked_pdf",
  );

  const buffer = await renderToBuffer(
    <ComplianceAssessmentPdfDocument snapshot={snapshot} watermarked={watermarked} />,
  );
  const disposition = doc.status === "draft" ? "attachment" : "inline";
  const safeName = String(doc.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="clearesg-assessment-${safeName || doc.reportingYear}.pdf"`,
    },
  });
}
