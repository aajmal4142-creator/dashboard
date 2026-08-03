import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { parseShareBody } from "@/lib/suppliers/network";
import { acceptNetworkInvite } from "@/lib/suppliers/networkService";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/app/suppliers/network/invites/[id]/accept
 * Authenticated supplier org accepts and shares an explicit consented snapshot.
 */
export async function POST(req: Request, { params }: RouteParams) {
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

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseShareBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = await getPayload({ config });
    try {
      const result = await acceptNetworkInvite({
        payload,
        inviteId: id,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        supplierOrganisationId: ctx.activeOrg.id,
        share: parsed,
      });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to accept invite";
      const status = /not found/i.test(message)
        ? 404
        : /does not match|expired|same organisation|Cannot accept/i.test(message)
          ? 400
          : 400;
      return NextResponse.json({ error: message }, { status });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Network invite accept error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
