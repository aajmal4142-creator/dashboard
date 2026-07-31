import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { MissingNaceError } from "@/lib/suppliers/tier2Emissions";
import { estimateTier2ForSupplier } from "@/lib/suppliers/tier2EmissionsService";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/suppliers/[id]/tier-2-estimate
 * Trigger hybrid Tier 2/3 calculation and persist results.
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
  let allowTopDown = false;
  try {
    const body = (await req.json()) as { allowTopDown?: boolean };
    allowTopDown = body.allowTopDown === true;
  } catch {
    allowTopDown = false;
  }

  const payload = await getPayload({ config });
  try {
    const result = await estimateTier2ForSupplier({
      payload,
      organisationId: auth.activeOrg.id,
      supplierId,
      allowTopDown,
    });
    return NextResponse.json({
      ok: true,
      cascade: result.cascade,
      persisted: result.persisted,
    });
  } catch (err) {
    if (err instanceof MissingNaceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Estimate failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
