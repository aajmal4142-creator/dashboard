import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { COMPLIANCE_ASSESSMENTS_SLUG } from "@/collections/ComplianceAssessments";
import { REPORT_TEMPLATES_SLUG } from "@/collections/ReportTemplates";
import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { recomputeResults, templateDocToSnapshot } from "@/lib/complianceTemplates";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * GET /api/app/compliance/assessments — list assessments for active org
 * POST — create draft assessment from a compliance template
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: COMPLIANCE_ASSESSMENTS_SLUG,
    where: { organisation: { equals: ctx.activeOrg.id } },
    sort: "-reportingYear",
    limit: 50,
    depth: 1,
    overrideAccess: true,
  });

  return NextResponse.json({
    assessments: result.docs.map((d) => {
      const template = d.template;
      const templateName =
        typeof template === "object" && template && "templateName" in template
          ? String(template.templateName)
          : null;
      return {
        id: d.id,
        title: d.title,
        reportingYear: d.reportingYear,
        status: d.status,
        templateId: relationId(d.template),
        templateName,
        finalisedAt: d.finalisedAt ?? null,
        updatedAt: d.updatedAt,
      };
    }),
    total: result.totalDocs,
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    templateId?: string;
    title?: string;
    reportingYear?: number;
  };

  if (!body.templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const reportingYear =
    typeof body.reportingYear === "number" && body.reportingYear >= 2000
      ? body.reportingYear
      : new Date().getFullYear();

  const payload = await getPayload({ config });

  let template;
  try {
    template = await payload.findByID({
      collection: REPORT_TEMPLATES_SLUG,
      id: body.templateId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (template.purpose !== "compliance") {
    return NextResponse.json(
      { error: "Template is not a compliance assessment template" },
      { status: 400 },
    );
  }

  const owner = relationId(template.organisation);
  const usable = Boolean(template.isPublic) || owner === ctx.activeOrg.id;
  if (!usable) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const templateSnapshot = templateDocToSnapshot(template);
  const calculationResults = recomputeResults(templateSnapshot, {});
  const title =
    String(body.title ?? "").trim() || `${template.templateName} ${reportingYear}`;

  const now = new Date().toISOString();
  const doc = await payload.create({
    collection: COMPLIANCE_ASSESSMENTS_SLUG,
    data: {
      organisation: ctx.activeOrg.id,
      template: template.id,
      title,
      reportingYear,
      status: "draft",
      answers: {},
      calculationResults,
      templateSnapshot,
      changeHistory: [
        {
          at: now,
          actor: ctx.user.id,
          action: "created",
          summary: `Draft assessment from ${template.templateName}`,
        },
      ],
    },
    overrideAccess: true,
  });

  // Bump usage on template
  await payload.update({
    collection: REPORT_TEMPLATES_SLUG,
    id: template.id,
    data: { usageCount: Number(template.usageCount ?? 0) + 1 },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "compliance_assessment.create",
    entityType: "compliance-assessment",
    entityId: String(doc.id),
    after: { title, reportingYear, templateId: template.id },
  });

  return NextResponse.json(
    {
      id: doc.id,
      title: doc.title,
      reportingYear: doc.reportingYear,
      status: doc.status,
      answers: doc.answers,
      calculationResults: doc.calculationResults,
      templateSnapshot: doc.templateSnapshot,
    },
    { status: 201 },
  );
}
