import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { finalizeRestatement } from "@/lib/compliance/ghg";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/app/compliance/ghg/restatements/[id]/finalize
 * Locks the restatement and writes the disclosure-package note.
 */
export async function POST(_req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const restatement = await finalizeRestatement(
      payload,
      ctx.activeOrg.id,
      id,
      ctx.user.id,
      ctx.activeOrg.name,
    );

    if (!restatement) {
      return NextResponse.json({ error: "Restatement not found" }, { status: 404 });
    }

    return NextResponse.json({ restatement });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatement finalize error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
