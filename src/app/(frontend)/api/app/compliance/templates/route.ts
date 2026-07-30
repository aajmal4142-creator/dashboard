import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  buildTemplateSnapshot,
  ensureIndustryStarters,
  templateDocToSnapshot,
  type ComplianceIndustry,
} from "@/lib/complianceTemplates";
import { requirePermission } from "@/lib/policy/protect";
import { REPORT_TEMPLATES_SLUG } from "@/collections/ReportTemplates";
import config from "@/payload.config";
import type { ReportTemplate } from "@/payload-types";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asIndustry(value: unknown): ComplianceIndustry | undefined {
  const allowed: ComplianceIndustry[] = [
    "general",
    "oil_gas",
    "manufacturing",
    "finance",
    "retail",
  ];
  if (typeof value === "string" && allowed.includes(value as ComplianceIndustry)) {
    return value as ComplianceIndustry;
  }
  return undefined;
}

/**
 * GET /api/app/compliance/templates — list public + org compliance templates
 * POST — create custom compliance template for active org
 */
export async function GET(req: Request) {
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
  const seed = await ensureIndustryStarters(payload);

  const url = new URL(req.url);
  const industry = asIndustry(url.searchParams.get("industry"));

  const where: Where = {
    and: [
      { purpose: { equals: "compliance" } },
      {
        or: [
          { isPublic: { equals: true } },
          { organisation: { equals: ctx.activeOrg.id } },
        ],
      },
      ...(industry ? [{ industry: { equals: industry } }] : []),
    ],
  };

  const result = await payload.find({
    collection: REPORT_TEMPLATES_SLUG,
    where,
    sort: "templateName",
    limit: 100,
    overrideAccess: true,
  });

  return NextResponse.json({
    templates: result.docs.map((t) => ({
      id: t.id,
      templateName: t.templateName,
      description: t.description ?? null,
      industry: t.industry ?? null,
      framework: t.framework,
      isPublic: Boolean(t.isPublic),
      organisationId: relationId(t.organisation),
      questionCount: Array.isArray(t.questions) ? t.questions.length : 0,
      calculationCount: Array.isArray(t.calculations) ? t.calculations.length : 0,
      version: t.version ?? 1,
    })),
    total: result.totalDocs,
    seed,
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
    templateName?: string;
    description?: string;
    industry?: string;
    framework?: string;
    sections?: unknown[];
    questions?: unknown[];
    calculations?: unknown[];
    isPublic?: boolean;
  };

  const baseName = String(body.templateName ?? "").trim();
  if (!baseName) {
    return NextResponse.json({ error: "templateName is required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const uniqueName = `${baseName} [${ctx.activeOrg.id.slice(-6)}]`;

  const normalized = buildTemplateSnapshot({
    templateId: "pending",
    templateName: uniqueName,
    industry: asIndustry(body.industry) ?? "general",
    description: body.description?.trim() || null,
    sections: body.sections,
    questions: body.questions,
    calculations: body.calculations,
  });

  if (normalized.questions.length === 0) {
    return NextResponse.json(
      { error: "At least one question is required" },
      { status: 400 },
    );
  }

  const data: Omit<ReportTemplate, "id" | "updatedAt" | "createdAt"> = {
    organisation: ctx.activeOrg.id,
    templateName: uniqueName,
    description: body.description?.trim() || undefined,
    purpose: "compliance",
    industry: asIndustry(body.industry) ?? "general",
    framework:
      body.framework === "csrd" ||
      body.framework === "brsr" ||
      body.framework === "gri" ||
      body.framework === "sasb"
        ? body.framework
        : "custom",
    type: "pdf",
    isPublic: false,
    version: 1,
    createdBy: ctx.user.id,
    sections: normalized.sections.map((s) => ({
      sectionTitle: s.sectionTitle,
      sectionKey: s.sectionKey,
      sectionType: s.sectionType,
      order: s.order ?? undefined,
    })),
    questions: normalized.questions.map((q) => ({
      questionId: q.questionId,
      sectionKey: q.sectionKey,
      label: q.label,
      prompt: q.prompt,
      answerType: q.answerType,
      options: q.options ?? undefined,
      unit: q.unit ?? undefined,
      required: q.required,
      order: q.order ?? undefined,
    })),
    calculations: normalized.calculations.map((c) => ({
      calcId: c.calcId,
      label: c.label,
      op: c.op,
      inputs: c.inputs,
      unit: c.unit ?? undefined,
      sectionKey: c.sectionKey ?? undefined,
    })),
  };

  const doc = await payload.create({
    collection: REPORT_TEMPLATES_SLUG,
    data,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "compliance_template.create",
    entityType: "report-template",
    entityId: String(doc.id),
    after: { templateName: doc.templateName, purpose: "compliance" },
  });

  return NextResponse.json(
    {
      id: doc.id,
      templateName: doc.templateName,
      snapshot: templateDocToSnapshot(doc),
    },
    { status: 201 },
  );
}
