import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { listSharesForBuyer } from "@/lib/suppliers/networkService";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/network/shares — consented emission snapshots for the buyer org
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
    const shares = await listSharesForBuyer(payload, ctx.activeOrg.id);

    return NextResponse.json({
      shares,
      organisationId: ctx.activeOrg.id,
      organisationName: ctx.activeOrg.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Network shares list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
