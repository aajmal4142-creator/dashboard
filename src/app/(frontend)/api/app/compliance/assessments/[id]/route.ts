import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { COMPLIANCE_ASSESSMENTS_SLUG } from "@/collections/ComplianceAssessments";
import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  buildAssessmentSnapshot,
  parseAnswers,
  recomputeResults,
  validateRequiredAnswers,
  type ComplianceAnswersMap,
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

async function loadAssessment(id: string, orgId: string) {
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
    return { payload, doc: null };
  }
  if (relationId(doc.organisation) !== orgId) {
    return { payload, doc: null };
  }
  return { payload, doc };
}

/**
 * GET /api/app/compliance/assessments/[id]
 * PATCH — save answers / finalize
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
  const { doc } = await loadAssessment(id, auth.activeOrg.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    reportingYear: doc.reportingYear,
    status: doc.status,
    templateId: relationId(doc.template),
    answers: doc.answers ?? {},
    calculationResults: doc.calculationResults ?? {},
    templateSnapshot: doc.templateSnapshot,
    finalisedAt: doc.finalisedAt ?? null,
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
  const { payload, doc } = await loadAssessment(id, auth.activeOrg.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.status === "final") {
    return NextResponse.json(
      { error: "Final assessments are immutable" },
      { status: 409 },
    );
  }

  const body = (await req.json()) as {
    action?: "save" | "finalize";
    answers?: ComplianceAnswersMap;
    title?: string;
  };

  const action = body.action ?? "save";
  const templateSnapshot = doc.templateSnapshot as ComplianceTemplateSnapshot | null;
  if (!templateSnapshot || !Array.isArray(templateSnapshot.questions)) {
    return NextResponse.json(
      { error: "Assessment is missing a template snapshot" },
      { status: 500 },
    );
  }

  const answers = parseAnswers(body.answers ?? doc.answers);
  const calculationResults = recomputeResults(templateSnapshot, answers);
  const now = new Date().toISOString();

  if (action === "finalize") {
    const missing = validateRequiredAnswers(templateSnapshot.questions, answers);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Required questions incomplete: ${missing.join(", ")}`,
          missing,
        },
        { status: 400 },
      );
    }

    const snapshot = buildAssessmentSnapshot({
      organisationName: auth.activeOrg.name,
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : doc.title,
      reportingYear: Number(doc.reportingYear),
      status: "final",
      template: templateSnapshot,
      answers,
      calculationResults,
      preparedBy: { id: auth.user.id, name: auth.user.email },
    });

    const history = Array.isArray(doc.changeHistory) ? [...doc.changeHistory] : [];
    history.push({
      at: now,
      actor: auth.user.id,
      action: "finalised",
      summary: "Assessment finalised",
    });

    const updated = await payload.update({
      collection: COMPLIANCE_ASSESSMENTS_SLUG,
      id,
      data: {
        title: snapshot.title,
        answers,
        calculationResults,
        status: "final",
        snapshot,
        finalisedAt: now,
        finalisedBy: auth.user.id,
        changeHistory: history,
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: auth.activeOrg.id,
      actorId: auth.user.id,
      action: "compliance_assessment.finalize",
      entityType: "compliance-assessment",
      entityId: String(id),
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      answers: updated.answers,
      calculationResults: updated.calculationResults,
      snapshot: updated.snapshot,
    });
  }

  const history = Array.isArray(doc.changeHistory) ? [...doc.changeHistory] : [];
  history.push({
    at: now,
    actor: auth.user.id,
    action: "saved",
    summary: "Answers saved",
  });

  const updated = await payload.update({
    collection: COMPLIANCE_ASSESSMENTS_SLUG,
    id,
    data: {
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : doc.title,
      answers,
      calculationResults,
      changeHistory: history,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "compliance_assessment.save",
    entityType: "compliance-assessment",
    entityId: String(id),
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    answers: updated.answers,
    calculationResults: updated.calculationResults,
  });
}
