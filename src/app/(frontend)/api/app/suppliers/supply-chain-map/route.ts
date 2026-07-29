import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  buildSupplyChainGraph,
  analyzeBottlenecks,
} from "@/lib/suppliers/bottleneckAnalyzer";
import config from "@/payload.config";

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
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
  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 500,
    overrideAccess: true,
  });

  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    overrideAccess: true,
  });

  // Build graph data
  const graphData = suppliers.docs.map((s) => {
    const rawTier = (s.riskMetrics as Record<string, unknown> | null)?.tier;
    let riskTier: "low" | "medium" | "high" | "critical" | undefined;
    if (
      rawTier === "low" ||
      rawTier === "medium" ||
      rawTier === "high" ||
      rawTier === "critical"
    ) {
      riskTier = rawTier;
    }

    return {
      id: String(s.id),
      name: s.name,
      tier: 1, // Simplified for now
      spend: s.annualSpend ?? 0,
      emissions: 0, // Would come from Scope 3 data
      riskTier,
      country: s.country ?? undefined,
      category: s.category ?? undefined,
    };
  });

  const graph = buildSupplyChainGraph(org?.name ?? "Your Organization", graphData);
  const bottlenecks = analyzeBottlenecks(graphData);

  return NextResponse.json({
    graph,
    bottlenecks,
  });
}
