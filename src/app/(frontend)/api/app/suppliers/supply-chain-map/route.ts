import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { analyzeBottlenecks } from "@/lib/suppliers/bottleneckAnalyzer";
import {
  buildNetworkView,
  createNetworkFromSuppliers,
  listNetworksForOrg,
} from "@/lib/suppliers/supplyChainService";
import type { SizeMode } from "@/lib/suppliers/supplyChainMap";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/supply-chain-map
 * Convenience: latest org network + bottleneck analysis (Membership-gated).
 */
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const sizeMode: SizeMode =
    url.searchParams.get("size") === "spend" ? "spend" : "emissions";
  const tiersRaw = url.searchParams.get("tiers");
  const visibleTiers: number[] | "all" =
    !tiersRaw || tiersRaw === "all"
      ? "all"
      : tiersRaw
          .split(",")
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  const payload = await getPayload({ config });
  let networks = await listNetworksForOrg(payload, ctx.activeOrg.id);

  // Auto-build once when org has suppliers but no network yet
  if (networks.length === 0) {
    const suppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1,
      overrideAccess: true,
    });
    if (suppliers.totalDocs > 0) {
      await createNetworkFromSuppliers({
        payload,
        organisationId: ctx.activeOrg.id,
        includeEstimates: true,
      });
      networks = await listNetworksForOrg(payload, ctx.activeOrg.id);
    }
  }

  const latest = networks[0];
  if (!latest) {
    return NextResponse.json({
      network: null,
      layout: null,
      bottlenecks: null,
      message: "No suppliers yet — add suppliers, then build a network.",
    });
  }

  const view = await buildNetworkView({
    payload,
    organisationId: ctx.activeOrg.id,
    orgName: ctx.activeOrg.name,
    networkKey: latest.id,
    visibleTiers: visibleTiers.length === 0 ? "all" : visibleTiers,
    sizeMode,
  });

  if (!view) {
    return NextResponse.json({ error: "Network not found" }, { status: 404 });
  }

  const bottleneckInput = view.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    tier: n.tier,
    spend: n.spend,
    emissions: n.emissions,
    country: n.location ?? undefined,
    category: n.category ?? undefined,
  }));
  const bottlenecks = analyzeBottlenecks(bottleneckInput);

  return NextResponse.json({
    network: { id: view.id, name: view.name },
    organisationName: ctx.activeOrg.name,
    sizeMode: view.sizeMode,
    nodes: view.nodes,
    layout: view.layout,
    bottlenecks,
  });
}
