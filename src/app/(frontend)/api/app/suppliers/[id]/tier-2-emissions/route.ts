import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { MissingNaceError } from "@/lib/suppliers/tier2Emissions";
import { getTier2Emissions } from "@/lib/suppliers/tier2EmissionsService";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/suppliers/[id]/tier-2-emissions
 * Read estimated Tier 2/3 emissions for a Tier-1 supplier.
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
  try {
    const cascade = await getTier2Emissions({
      payload,
      organisationId: auth.activeOrg.id,
      supplierId,
    });
    return NextResponse.json({ cascade });
  } catch (err) {
    if (err instanceof MissingNaceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Load failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
