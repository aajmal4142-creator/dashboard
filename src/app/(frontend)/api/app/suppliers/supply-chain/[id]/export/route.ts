import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { exportNetworkCsv } from "@/lib/suppliers/supplyChainService";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/suppliers/supply-chain/[id]/export — CSV export of network nodes
 */
export async function GET(_req: Request, ctxRoute: RouteCtx) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "export",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctxRoute.params;
  if (!id) {
    return NextResponse.json({ error: "Network id required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const csv = await exportNetworkCsv({
    payload,
    organisationId: ctx.activeOrg.id,
    orgName: ctx.activeOrg.name,
    networkKey: id,
  });

  if (!csv) {
    return NextResponse.json(
      { error: "Network not found for this organisation" },
      { status: 404 },
    );
  }

  const safeName = ctx.activeOrg.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clearesg-supply-chain-${safeName}.csv"`,
    },
  });
}
