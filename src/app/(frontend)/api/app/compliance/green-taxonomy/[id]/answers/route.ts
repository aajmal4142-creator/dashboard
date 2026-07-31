import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  isValidObjectiveId,
  saveAssessmentAnswers,
  type AnswersPatch,
  type AssessmentStatus,
  type YesNo,
} from "@/lib/compliance/greenTaxonomy";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function asYesNo(value: unknown): YesNo | undefined {
  if (value === "yes" || value === "no" || value === "unanswered") return value;
  return undefined;
}

function asStatus(value: unknown): AssessmentStatus | undefined {
  if (value === "draft" || value === "completed" || value === "verified") {
    return value;
  }
  return undefined;
}

/**
 * POST /api/app/compliance/green-taxonomy/[id]/answers
 * Save NACE / applicability / screening / DNSH answers.
 */
export async function POST(req: Request, ctxParams: Ctx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctxParams.params;
    const body = (await req.json()) as Record<string, unknown>;

    const patch: AnswersPatch = {};

    if (typeof body.naceCode === "string") patch.naceCode = body.naceCode;
    if (body.periodId === null) patch.periodId = null;
    else if (typeof body.periodId === "string") patch.periodId = body.periodId;
    if (typeof body.wizardStep === "number") patch.wizardStep = body.wizardStep;
    if (typeof body.notes === "string" || body.notes === null) {
      patch.notes = body.notes as string | null;
    }
    const status = asStatus(body.status);
    if (status) patch.status = status;

    if (Array.isArray(body.objectives)) {
      patch.objectives = [];
      for (const row of body.objectives) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        if (typeof r.objective !== "string" || !isValidObjectiveId(r.objective)) {
          continue;
        }
        const answers = Array.isArray(r.answers)
          ? r.answers
              .map((a) => {
                if (!a || typeof a !== "object") return null;
                const ar = a as Record<string, unknown>;
                if (typeof ar.criteriaId !== "string") return null;
                return {
                  criteriaId: ar.criteriaId,
                  met: asYesNo(ar.met),
                  evidenceId:
                    ar.evidenceId === null
                      ? null
                      : typeof ar.evidenceId === "string"
                        ? ar.evidenceId
                        : undefined,
                  notes:
                    ar.notes === null
                      ? null
                      : typeof ar.notes === "string"
                        ? ar.notes
                        : undefined,
                };
              })
              .filter((a): a is NonNullable<typeof a> => a !== null)
          : undefined;
        patch.objectives.push({
          objective: r.objective,
          applicable: asYesNo(r.applicable),
          answers,
        });
      }
    }

    if (Array.isArray(body.dnshCompliance)) {
      patch.dnshCompliance = [];
      for (const row of body.dnshCompliance) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        if (
          typeof r.objective !== "string" ||
          !isValidObjectiveId(r.objective) ||
          typeof r.criteriaId !== "string"
        ) {
          continue;
        }
        patch.dnshCompliance.push({
          objective: r.objective,
          criteriaId: r.criteriaId,
          compliant: asYesNo(r.compliant),
          notes:
            r.notes === null ? null : typeof r.notes === "string" ? r.notes : undefined,
        });
      }
    }

    const payload = await getPayload({ config });
    try {
      const assessment = await saveAssessmentAnswers(
        payload,
        ctx.activeOrg.id,
        id,
        patch,
      );
      return NextResponse.json({ assessment });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      if (message.includes("not found") || message.includes("Not found")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Green taxonomy answers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
