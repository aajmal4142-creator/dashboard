import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { listIncomingInvitesForEmail } from "@/lib/suppliers/networkService";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/network/invites/incoming
 * Pending invites addressed to the authenticated user's email (supplier side).
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "supplier",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const invites = await listIncomingInvitesForEmail(payload, ctx.user.email);

    return NextResponse.json({
      invites,
      organisationId: ctx.activeOrg.id,
      organisationName: ctx.activeOrg.name,
      userEmail: ctx.user.email,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Incoming network invites error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
