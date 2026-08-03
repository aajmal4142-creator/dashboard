import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { revokeNetworkInvite } from "@/lib/suppliers/networkService";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/app/suppliers/network/invites/[id]/revoke
 * Buyer org revokes a pending (or accepted) invite.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "supplier",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const payload = await getPayload({ config });
    try {
      const invite = await revokeNetworkInvite({
        payload,
        inviteId: id,
        buyerOrganisationId: ctx.activeOrg.id,
      });
      return NextResponse.json({ invite });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke invite";
      const status = /not found/i.test(message) ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Network invite revoke error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
