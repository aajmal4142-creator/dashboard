import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { createNetworkInvite, listInvitesForBuyer } from "@/lib/suppliers/networkService";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/network/invites — list invites sent by the buyer org
 * POST — create invite (email + optional display name / message)
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
    const invites = await listInvitesForBuyer(payload, ctx.activeOrg.id);

    return NextResponse.json({
      invites,
      organisationId: ctx.activeOrg.id,
      organisationName: ctx.activeOrg.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Network invites list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "supplier",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const inviteEmail = typeof body.inviteEmail === "string" ? body.inviteEmail : "";
    const supplierDisplayName =
      typeof body.supplierDisplayName === "string" ? body.supplierDisplayName : null;
    const message = typeof body.message === "string" ? body.message : null;

    const payload = await getPayload({ config });
    try {
      const invite = await createNetworkInvite({
        payload,
        buyerOrganisationId: ctx.activeOrg.id,
        invitedByUserId: ctx.user.id,
        inviteEmail,
        supplierDisplayName,
        message,
      });
      return NextResponse.json({ invite }, { status: 201 });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Failed to create invite";
      return NextResponse.json({ error: messageText }, { status: 400 });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Network invite create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
