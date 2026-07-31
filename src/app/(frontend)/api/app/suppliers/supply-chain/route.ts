import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  createNetworkFromSuppliers,
  listNetworksForOrg,
} from "@/lib/suppliers/supplyChainService";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/supply-chain — list networks for active org
 * POST — create network from Suppliers (Tier 1) + optional Tier 2/3 estimates
 */
export async function GET() {
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
  const networks = await listNetworksForOrg(payload, ctx.activeOrg.id);

  return NextResponse.json({
    networks,
    organisationId: ctx.activeOrg.id,
    organisationName: ctx.activeOrg.name,
  });
}

export async function POST(req: Request) {
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

  let body: { name?: string; includeEstimates?: boolean } = {};
  try {
    body = (await req.json()) as { name?: string; includeEstimates?: boolean };
  } catch {
    body = {};
  }

  const payload = await getPayload({ config });
  try {
    const created = await createNetworkFromSuppliers({
      payload,
      organisationId: ctx.activeOrg.id,
      name: body.name,
      includeEstimates: body.includeEstimates !== false,
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        edgeCount: created.edgeCount,
        estimatedAdded: created.estimatedAdded,
        organisationId: ctx.activeOrg.id,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create network";
    const status = /no suppliers/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
