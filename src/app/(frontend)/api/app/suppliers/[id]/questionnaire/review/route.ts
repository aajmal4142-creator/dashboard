import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { reviewQuestionnaire } from "@/lib/suppliers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/app/suppliers/[id]/questionnaire/review
 * Mark reviewed / approved + notes. Auth required. No deletion.
 */
export async function PUT(req: Request, ctx: Ctx) {
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
  const body = (await req.json().catch(() => ({}))) as {
    notes?: string;
    approve?: boolean;
    archive?: boolean;
  };

  try {
    const questionnaire = await reviewQuestionnaire({
      organisationId: auth.activeOrg.id,
      supplierId,
      userId: auth.user.id,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      approve: body.approve === true,
      archive: body.archive === true,
    });
    return NextResponse.json({ ok: true, questionnaire });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("Cannot review")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
