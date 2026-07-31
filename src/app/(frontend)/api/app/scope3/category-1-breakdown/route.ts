import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { getCategory1Breakdown } from "@/lib/suppliers/tier2EmissionsService";
import config from "@/payload.config";

/**
 * GET /api/app/scope3/category-1-breakdown
 * Scope 3 Category 1 = Tier 1 direct + Tier 2 + Tier 3 (no double-count).
 */
export async function GET() {
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

  const payload = await getPayload({ config });
  try {
    const breakdown = await getCategory1Breakdown({
      payload,
      organisationId: auth.activeOrg.id,
    });
    return NextResponse.json({ breakdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Breakdown failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
