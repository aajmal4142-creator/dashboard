/**
 * Payload I/O for supply-chain networks.
 * Pure layout / estimate / CSV live in supplyChainMap.ts.
 */

import { randomUUID } from "crypto";
import type { Payload } from "payload";

import { SUPPLY_CHAIN_NETWORKS_SLUG } from "@/collections/SupplyChainNetworks";
import {
  SUPPLIER_REPORTED_METRIC,
  SUPPLIER_SPEND_ESTIMATE_METRIC,
} from "@/lib/suppliers/fields";
import {
  applyTierUpdates,
  clampTier,
  estimateDownstreamTiers,
  filterByTiers,
  layoutRadialGraph,
  mergeWithEstimates,
  networkToCsv,
  parseScope,
  parseStrength,
  type RelationshipStrength,
  type SizeMode,
  type SupplyChainNodeInput,
  type SupplyChainScope,
} from "@/lib/suppliers/supplyChainMap";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

type EdgeDoc = {
  id: string;
  name?: string | null;
  networkKey?: string | null;
  networkName?: string | null;
  organisation?: unknown;
  supplier_id?: unknown;
  parent_supplier_id?: unknown;
  parentNodeKey?: string | null;
  tier_level?: number | null;
  scope?: string | null;
  location?: string | null;
  category?: string | null;
  estimated?: boolean | null;
  spend?: number | null;
  emissions?: number | null;
  relationship_strength?: string | null;
  createdAt?: string;
};

export function edgeDocToNode(doc: EdgeDoc): SupplyChainNodeInput {
  const supplierId = relationId(doc.supplier_id);
  const parentSupplier = relationId(doc.parent_supplier_id);
  return {
    id: String(doc.id),
    name: doc.name ?? "Supplier",
    tier: clampTier(Number(doc.tier_level ?? 1)),
    spend: asNumber(doc.spend),
    emissions: asNumber(doc.emissions),
    scope: parseScope(doc.scope),
    location: doc.location ?? null,
    category: doc.category ?? null,
    estimated: Boolean(doc.estimated),
    parentId: doc.parentNodeKey ?? parentSupplier,
    relationshipStrength: parseStrength(doc.relationship_strength),
    supplierId,
  };
}

async function loadSupplierEmissionsMap(
  payload: Payload,
  organisationId: string,
  supplierIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (supplierIds.length === 0) return map;

  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        {
          metricKey: {
            in: [SUPPLIER_REPORTED_METRIC, SUPPLIER_SPEND_ESTIMATE_METRIC],
          },
        },
      ],
    },
    limit: 2000,
    overrideAccess: true,
  });

  for (const dp of dps.docs) {
    const sid =
      typeof dp.supplierKey === "string" && dp.supplierKey
        ? dp.supplierKey
        : relationId(dp.supplier);
    if (!sid || !supplierIds.includes(sid)) continue;
    const value = asNumber(dp.value);
    if (!(value > 0)) continue;
    // Prefer reported over estimate: reported written later wins if both present
    const prev = map.get(sid) ?? 0;
    if (dp.metricKey === SUPPLIER_REPORTED_METRIC || prev === 0) {
      map.set(sid, value);
    }
  }
  return map;
}

/** Spend-based fallback when no datapoint: ~0.3 tCO2e per $1k spend (illustrative). */
function estimateEmissionsFromSpend(spend: number, location: string | null): number {
  if (!(spend > 0)) return 0;
  const base = (spend / 1000) * 0.3;
  // Soft location nudge without importing locationIntensityFactor cycle issues
  const key = (location ?? "").trim().toUpperCase();
  const factor =
    key === "IN" || key === "INDIA" || key === "CN" || key === "CHINA"
      ? 1.2
      : key === "NO" || key === "SE" || key === "FR"
        ? 0.85
        : 1;
  return Math.round(base * factor * 100) / 100;
}

export type NetworkSummary = {
  id: string;
  name: string;
  organisationId: string;
  edgeCount: number;
  createdAt?: string;
};

export async function listNetworksForOrg(
  payload: Payload,
  organisationId: string,
): Promise<NetworkSummary[]> {
  const result = await payload.find({
    collection: SUPPLY_CHAIN_NETWORKS_SLUG,
    where: { organisation: { equals: organisationId } },
    limit: 500,
    sort: "-createdAt",
    overrideAccess: true,
  });

  const byKey = new Map<string, NetworkSummary>();
  for (const doc of result.docs) {
    const key = typeof doc.networkKey === "string" ? doc.networkKey : null;
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.edgeCount += 1;
      continue;
    }
    const displayName =
      (typeof doc.networkName === "string" && doc.networkName) ||
      (typeof doc.name === "string"
        ? doc.name.replace(/ · Tier.*$/, "")
        : "Supply chain");
    byKey.set(key, {
      id: key,
      name: displayName,
      organisationId,
      edgeCount: 1,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : undefined,
    });
  }
  return [...byKey.values()];
}

export async function loadNetworkEdges(
  payload: Payload,
  organisationId: string,
  networkKey: string,
): Promise<EdgeDoc[]> {
  const result = await payload.find({
    collection: SUPPLY_CHAIN_NETWORKS_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { networkKey: { equals: networkKey } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  });
  return result.docs as EdgeDoc[];
}

export async function buildNetworkView(opts: {
  payload: Payload;
  organisationId: string;
  orgName: string;
  networkKey: string;
  visibleTiers?: number[] | "all";
  sizeMode?: SizeMode;
}): Promise<{
  id: string;
  name: string;
  nodes: SupplyChainNodeInput[];
  layout: ReturnType<typeof layoutRadialGraph>;
  sizeMode: SizeMode;
  visibleTiers: number[] | "all";
} | null> {
  const edges = await loadNetworkEdges(
    opts.payload,
    opts.organisationId,
    opts.networkKey,
  );
  if (edges.length === 0) return null;

  const persisted = edges.map(edgeDocToNode);
  const merged = mergeWithEstimates(persisted);
  const visibleTiers = opts.visibleTiers ?? "all";
  const filtered = filterByTiers(merged, visibleTiers);
  const sizeMode = opts.sizeMode ?? "emissions";

  const networkName =
    (typeof edges[0]?.networkName === "string" && edges[0].networkName) ||
    edges[0]?.name?.replace(/ · Tier.*$/, "") ||
    "Supply chain network";

  return {
    id: opts.networkKey,
    name: networkName,
    nodes: merged,
    layout: layoutRadialGraph({
      orgName: opts.orgName,
      nodes: filtered,
      sizeMode,
    }),
    sizeMode,
    visibleTiers,
  };
}

export async function createNetworkFromSuppliers(opts: {
  payload: Payload;
  organisationId: string;
  name?: string;
  includeEstimates?: boolean;
}): Promise<{
  id: string;
  name: string;
  edgeCount: number;
  estimatedAdded: number;
}> {
  const suppliers = await opts.payload.find({
    collection: "suppliers",
    where: { organisation: { equals: opts.organisationId } },
    limit: 500,
    overrideAccess: true,
  });

  if (suppliers.docs.length === 0) {
    throw new Error(
      "No suppliers in this organisation. Add suppliers before building a network.",
    );
  }

  const networkKey = randomUUID();
  const networkName =
    typeof opts.name === "string" && opts.name.trim()
      ? opts.name.trim()
      : `Supply chain ${new Date().toISOString().slice(0, 10)}`;

  const supplierIds = suppliers.docs.map((s) => String(s.id));
  const emissionsMap = await loadSupplierEmissionsMap(
    opts.payload,
    opts.organisationId,
    supplierIds,
  );

  let edgeCount = 0;
  const tier1Nodes: SupplyChainNodeInput[] = [];

  for (const s of suppliers.docs) {
    const sid = String(s.id);
    const spend = asNumber(s.annualSpend);
    const location = typeof s.country === "string" ? s.country : null;
    const emissions =
      emissionsMap.get(sid) ?? estimateEmissionsFromSpend(spend, location);
    const category = typeof s.category === "string" ? s.category : null;

    // Scope heuristic: electricity-like → Scope2, else Scope3 purchased goods
    const scope: SupplyChainScope =
      category === "other" && /power|electric|energy/i.test(s.name) ? "Scope2" : "Scope3";

    const created = await opts.payload.create({
      collection: SUPPLY_CHAIN_NETWORKS_SLUG,
      data: {
        organisation: opts.organisationId,
        networkKey,
        networkName,
        name: s.name,
        supplier_id: sid,
        tier_level: 1,
        scope,
        location: location ?? undefined,
        category: category ?? undefined,
        estimated: !emissionsMap.has(sid) && spend > 0,
        spend,
        emissions,
        relationship_strength:
          spend > 250_000 ? "high" : spend > 50_000 ? "medium" : "low",
      },
      overrideAccess: true,
    });

    edgeCount += 1;
    tier1Nodes.push(edgeDocToNode(created as EdgeDoc));
  }

  let estimatedAdded = 0;
  if (opts.includeEstimates !== false && tier1Nodes.length > 0) {
    const estimates = estimateDownstreamTiers(tier1Nodes);
    const idRemap = new Map<string, string>();

    // Persist Tier 2 first so Tier 3 can reference real edge ids
    const tier2 = estimates.filter((e) => e.tier === 2);
    const tier3 = estimates.filter((e) => e.tier === 3);

    for (const est of tier2) {
      const created = await opts.payload.create({
        collection: SUPPLY_CHAIN_NETWORKS_SLUG,
        data: {
          organisation: opts.organisationId,
          networkKey,
          networkName,
          name: est.name,
          supplier_id: undefined,
          parentNodeKey: est.parentId ?? undefined,
          tier_level: est.tier,
          scope: est.scope,
          location: est.location ?? undefined,
          category: est.category ?? undefined,
          estimated: true,
          spend: est.spend,
          emissions: est.emissions,
          relationship_strength: est.relationshipStrength ?? "medium",
        },
        overrideAccess: true,
      });
      idRemap.set(est.id, String(created.id));
      estimatedAdded += 1;
      edgeCount += 1;
    }

    for (const est of tier3) {
      const parentMapped =
        (est.parentId && idRemap.get(est.parentId)) || est.parentId || undefined;
      await opts.payload.create({
        collection: SUPPLY_CHAIN_NETWORKS_SLUG,
        data: {
          organisation: opts.organisationId,
          networkKey,
          networkName,
          name: est.name,
          supplier_id: undefined,
          parentNodeKey: parentMapped,
          tier_level: est.tier,
          scope: est.scope,
          location: est.location ?? undefined,
          category: est.category ?? undefined,
          estimated: true,
          spend: est.spend,
          emissions: est.emissions,
          relationship_strength: est.relationshipStrength ?? "medium",
        },
        overrideAccess: true,
      });
      estimatedAdded += 1;
      edgeCount += 1;
    }
  }

  return {
    id: networkKey,
    name: networkName,
    edgeCount,
    estimatedAdded,
  };
}

export async function updateNetworkTiers(opts: {
  payload: Payload;
  organisationId: string;
  networkKey: string;
  updates: Array<{
    id: string;
    tier?: number;
    parentId?: string | null;
    scope?: SupplyChainScope;
    relationshipStrength?: RelationshipStrength | null;
  }>;
}): Promise<{ updated: number }> {
  const edges = await loadNetworkEdges(
    opts.payload,
    opts.organisationId,
    opts.networkKey,
  );
  if (edges.length === 0) return { updated: 0 };

  const nodes = edges.map(edgeDocToNode);
  const next = applyTierUpdates(nodes, opts.updates);
  const nextById = new Map(next.map((n) => [n.id, n]));

  let updated = 0;
  for (const edge of edges) {
    const n = nextById.get(String(edge.id));
    if (!n) continue;
    const u = opts.updates.find((x) => x.id === String(edge.id));
    if (!u) continue;

    await opts.payload.update({
      collection: SUPPLY_CHAIN_NETWORKS_SLUG,
      id: edge.id,
      data: {
        tier_level: n.tier,
        parentNodeKey: n.parentId ?? undefined,
        scope: n.scope,
        relationship_strength: n.relationshipStrength ?? undefined,
        estimated: n.estimated,
        name: n.name.includes("· Tier")
          ? n.name.replace(/· Tier \d+/, `· Tier ${n.tier}`)
          : `${n.name} · Tier ${n.tier}`,
      },
      overrideAccess: true,
    });
    updated += 1;
  }

  return { updated };
}

export async function exportNetworkCsv(opts: {
  payload: Payload;
  organisationId: string;
  orgName: string;
  networkKey: string;
}): Promise<string | null> {
  const view = await buildNetworkView({
    payload: opts.payload,
    organisationId: opts.organisationId,
    orgName: opts.orgName,
    networkKey: opts.networkKey,
    visibleTiers: "all",
  });
  if (!view) return null;
  return networkToCsv(opts.orgName, view.nodes);
}
