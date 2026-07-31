import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  findQuestionnaireForSupplier,
  parseCustomSections,
  sendSupplierQuestionnaire,
} from "@/lib/suppliers";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/suppliers/[id]/questionnaire/send
 * Send ESG questionnaire invite (consent-gated).
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "supplier",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: supplierId } = await ctx.params;
  let body: { customSections?: unknown } = {};
  try {
    body = (await req.json()) as { customSections?: unknown };
  } catch {
    body = {};
  }

  const origin = new URL(req.url).origin;
  try {
    const result = await sendSupplierQuestionnaire({
      organisationId: auth.activeOrg.id,
      orgName: auth.activeOrg.name,
      supplierId,
      origin,
      customSections: parseCustomSections(body.customSections),
    });

    return NextResponse.json({
      ok: true,
      link: result.link,
      delivery: result.delivery,
      error: result.error,
      questionnaire: result.questionnaire,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    const status =
      message.includes("consent") || message.includes("email")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET — latest questionnaire for this supplier (org-scoped).
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "supplier",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: supplierId } = await ctx.params;
  const payload = await getPayload({ config });
  const questionnaire = await findQuestionnaireForSupplier(
    payload,
    auth.activeOrg.id,
    supplierId,
  );
  if (!questionnaire) {
    return NextResponse.json({ questionnaire: null });
  }
  return NextResponse.json({ questionnaire });
}
