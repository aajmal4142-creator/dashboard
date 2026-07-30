import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/analytics/scenarios/[id]
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });

  try {
    const scenario = await payload.findByID({
      collection: "scenarios",
      id,
      depth: 0,
    });

    const orgId =
      typeof scenario.organisation === "string"
        ? scenario.organisation
        : scenario.organisation?.id;

    if (!scenario || orgId !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ scenario });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/app/analytics/scenarios/[id]
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || auth.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });

  try {
    const existing = await payload.findByID({
      collection: "scenarios",
      id,
      depth: 0,
    });

    const orgId =
      typeof existing.organisation === "string"
        ? existing.organisation
        : existing.organisation?.id;

    if (!existing || orgId !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await payload.delete({
      collection: "scenarios",
      id,
    });

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
