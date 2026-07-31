import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { buildNetworkView } from "@/lib/suppliers/supplyChainService";
import type { SizeMode } from "@/lib/suppliers/supplyChainMap";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

function parseVisibleTiers(raw: string | null): number[] | "all" {
  if (!raw || raw === "all") return "all";
  if (raw === "1" || raw === "tier1") return [1];
  const parts = raw.split(",").map((p) => Number(p.trim()));
  const tiers = parts.filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  return tiers.length > 0 ? tiers : "all";
}

function parseSizeMode(raw: string | null): SizeMode {
  return raw === "spend" ? "spend" : "emissions";
}

/**
 * GET /api/app/suppliers/supply-chain/[id] — network + radial layout for visualization
 */
export async function GET(req: Request, ctxRoute: RouteCtx) {
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

  const { id } = await ctxRoute.params;
  if (!id) {
    return NextResponse.json({ error: "Network id required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const visibleTiers = parseVisibleTiers(url.searchParams.get("tiers"));
  const sizeMode = parseSizeMode(url.searchParams.get("size"));

  const payload = await getPayload({ config });
  const view = await buildNetworkView({
    payload,
    organisationId: ctx.activeOrg.id,
    orgName: ctx.activeOrg.name,
    networkKey: id,
    visibleTiers,
    sizeMode,
  });

  if (!view) {
    return NextResponse.json(
      { error: "Network not found for this organisation" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: view.id,
    name: view.name,
    organisationId: ctx.activeOrg.id,
    organisationName: ctx.activeOrg.name,
    sizeMode: view.sizeMode,
    visibleTiers: view.visibleTiers,
    nodes: view.nodes,
    layout: view.layout,
  });
}
