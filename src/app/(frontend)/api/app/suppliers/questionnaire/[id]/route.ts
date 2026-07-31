import { NextResponse } from "next/server";

import { generateQuestionnaireTemplate, loadPublicForm } from "@/lib/suppliers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/suppliers/questionnaire/[id]
 * Public form payload. `[id]` is the opaque publicToken (not a guessable DB id in emails).
 * No auth. Read-only — never deletes.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id: token } = await ctx.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  try {
    const form = await loadPublicForm(token);
    if (!form) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    // Strip internal identifiers — public surface only
    return NextResponse.json({
      token: form.token,
      orgName: form.orgName,
      supplierName: form.supplierName,
      status: form.status,
      expired: form.expired,
      alreadySubmitted: form.alreadySubmitted,
      expiresAt: form.expiresAt,
      template: form.template ?? generateQuestionnaireTemplate(),
      responses: form.alreadySubmitted ? form.responses : form.responses,
      completionPercent: form.completionPercent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
