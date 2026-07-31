import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { sendTier2Survey } from "@/lib/suppliers/tier2EmissionsService";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/suppliers/[id]/tier-2-survey
 * Send Tier 2 emissions survey (consent-gated).
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
  const payload = await getPayload({ config });
  const origin = new URL(req.url).origin;

  try {
    const result = await sendTier2Survey({
      payload,
      organisationId: auth.activeOrg.id,
      orgName: auth.activeOrg.name,
      supplierId,
      origin,
    });
    if (result.delivery === "skipped" || result.delivery === "failed") {
      return NextResponse.json(
        {
          error: result.error ?? "Survey not sent",
          delivery: result.delivery,
          link: result.link,
        },
        { status: result.delivery === "skipped" ? 400 : 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      link: result.link,
      delivery: result.delivery,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Survey failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
