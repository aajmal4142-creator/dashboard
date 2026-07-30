import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  buildTemplateSnapshot,
  templateDocToSnapshot,
  type ComplianceIndustry,
} from "@/lib/complianceTemplates";
import { requirePermission } from "@/lib/policy/protect";
import { REPORT_TEMPLATES_SLUG } from "@/collections/ReportTemplates";
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

async function loadTemplate(id: string, orgId: string) {
  const payload = await getPayload({ config });
  let doc;
  try {
    doc = await payload.findByID({
      collection: REPORT_TEMPLATES_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { payload, doc: null, error: "Not found" as const };
  }

  if (doc.purpose !== "compliance") {
    return { payload, doc: null, error: "Not found" as const };
  }

  const owner = relationId(doc.organisation);
  const visible = Boolean(doc.isPublic) || owner === orgId;
  if (!visible) {
    return { payload, doc: null, error: "Not found" as const };
  }

  return { payload, doc, error: null };
}

/**
 * GET /api/app/compliance/templates/[id]
 * PATCH — update org-owned custom template
 * DELETE — delete org-owned custom template
 */
export async function GET(_req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
  const { doc, error } = await loadTemplate(id, auth.activeOrg.id);
  if (!doc || error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: doc.id,
    templateName: doc.templateName,
    description: doc.description ?? null,
    industry: doc.industry ?? null,
    framework: doc.framework,
    isPublic: Boolean(doc.isPublic),
    organisationId: relationId(doc.organisation),
    snapshot: templateDocToSnapshot(doc),
  });
}

export async function PATCH(req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
  const { payload, doc, error } = await loadTemplate(id, auth.activeOrg.id);
  if (!doc || error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (relationId(doc.organisation) !== auth.activeOrg.id || doc.isPublic) {
    return NextResponse.json(
      { error: "Only org-owned custom templates can be edited" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    description?: string;
    industry?: string;
    sections?: unknown[];
    questions?: unknown[];
    calculations?: unknown[];
  };

  const normalized = buildTemplateSnapshot({
    templateId: String(doc.id),
    templateName: doc.templateName,
    industry: asIndustry(body.industry) ?? doc.industry ?? "general",
    description: body.description !== undefined ? body.description : doc.description,
    sections: body.sections ?? doc.sections,
    questions: body.questions ?? doc.questions,
    calculations: body.calculations ?? doc.calculations,
  });

  const updated = await payload.update({
    collection: REPORT_TEMPLATES_SLUG,
    id,
    data: {
      description: normalized.description,
      industry: normalized.industry ?? "general",
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
      version: Number(doc.version ?? 1) + 1,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "compliance_template.update",
    entityType: "report-template",
    entityId: String(id),
  });

  return NextResponse.json({
    id: updated.id,
    snapshot: templateDocToSnapshot(updated),
  });
}

export async function DELETE(_req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "delete",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
  const { payload, doc, error } = await loadTemplate(id, auth.activeOrg.id);
  if (!doc || error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (relationId(doc.organisation) !== auth.activeOrg.id || doc.isPublic) {
    return NextResponse.json(
      { error: "Only org-owned custom templates can be deleted" },
      { status: 403 },
    );
  }

  await payload.delete({
    collection: REPORT_TEMPLATES_SLUG,
    id,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "compliance_template.delete",
    entityType: "report-template",
    entityId: String(id),
  });

  return NextResponse.json({ ok: true });
}
