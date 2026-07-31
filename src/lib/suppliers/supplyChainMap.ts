/**
 * Pure supply-chain network model + radial layout + CSV export.
 * Zero I/O. Token colour keys only (CSS var names) — never hex.
 */

export const SUPPLY_CHAIN_SCOPES = ["Scope1", "Scope2", "Scope3"] as const;
export type SupplyChainScope = (typeof SUPPLY_CHAIN_SCOPES)[number];

export const SUPPLY_CHAIN_STRENGTHS = ["critical", "high", "medium", "low"] as const;
export type RelationshipStrength = (typeof SUPPLY_CHAIN_STRENGTHS)[number];

/** Configurable tier band — not hardcoded to 1–3 only. */
export const DEFAULT_MAX_TIER = 5;
export const DEFAULT_VISIBLE_TIERS = [1, 2, 3] as const;

export type SizeMode = "emissions" | "spend";

export type SupplyChainNodeInput = {
  id: string;
  name: string;
  tier: number;
  spend: number;
  emissions: number;
  scope: SupplyChainScope;
  location?: string | null;
  category?: string | null;
  estimated?: boolean;
  parentId?: string | null;
  relationshipStrength?: RelationshipStrength | null;
  supplierId?: string | null;
};

export type LaidOutNode = SupplyChainNodeInput & {
  x: number;
  y: number;
  radius: number;
  /** CSS custom-property name, e.g. "--signal" */
  colorVar: string;
  opacity: number;
};

export type LaidOutLink = {
  sourceId: string;
  targetId: string;
  weight: number;
  strength: number;
};

export type RadialLayout = {
  nodes: LaidOutNode[];
  links: LaidOutLink[];
  center: { id: string; label: string; x: number; y: number; radius: number };
  stats: {
    totalSuppliers: number;
    totalSpend: number;
    totalEmissions: number;
    tierCounts: Record<number, number>;
    estimatedCount: number;
  };
  viewBox: { width: number; height: number };
};

export type TierEstimateConfig = {
  /** Fraction of parent emissions attributed to each Tier-2 estimate. */
  tier2EmissionsFactor: number;
  /** Fraction of Tier-2 emissions attributed to each Tier-3 estimate. */
  tier3EmissionsFactor: number;
  /** Fraction of parent spend for estimated children. */
  spendFactor: number;
  maxTier2PerParent: number;
  maxTier3PerParent: number;
};

export const DEFAULT_TIER_ESTIMATE: TierEstimateConfig = {
  tier2EmissionsFactor: 0.4,
  tier3EmissionsFactor: 0.25,
  spendFactor: 0.35,
  maxTier2PerParent: 2,
  maxTier3PerParent: 1,
};

/** Scope → design token (signal/cobalt/amber per ClearESG data chrome). */
export function scopeColorVar(scope: SupplyChainScope): string {
  if (scope === "Scope1") return "--rust";
  if (scope === "Scope2") return "--cobalt";
  return "--signal";
}

export function parseScope(raw: unknown): SupplyChainScope {
  if (raw === "Scope1" || raw === "Scope2" || raw === "Scope3") return raw;
  return "Scope3";
}

export function parseStrength(raw: unknown): RelationshipStrength | null {
  if (raw === "critical" || raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }
  return null;
}

export function clampTier(tier: number, maxTier = DEFAULT_MAX_TIER): number {
  if (!Number.isFinite(tier)) return 1;
  return Math.min(maxTier, Math.max(1, Math.round(tier)));
}

/**
 * Country-level intensity multiplier for location-based estimation.
 * Unknown / missing location → 1 (neutral). Never throws.
 */
export function locationIntensityFactor(location: string | null | undefined): number {
  if (!location || typeof location !== "string") return 1;
  const key = location.trim().toUpperCase();
  if (!key) return 1;

  // Coarse free assumptions — not licensed factors.
  const HIGH = new Set(["CN", "CHINA", "IN", "INDIA", "ZA", "SOUTH AFRICA"]);
  const MID = new Set(["US", "USA", "UNITED STATES", "BR", "BRAZIL", "MX", "MEXICO"]);
  const LOW = new Set([
    "NO",
    "NORWAY",
    "SE",
    "SWEDEN",
    "FR",
    "FRANCE",
    "DE",
    "GERMANY",
    "GB",
    "UK",
    "UNITED KINGDOM",
  ]);

  if (HIGH.has(key)) return 1.25;
  if (MID.has(key)) return 1.05;
  if (LOW.has(key)) return 0.85;
  return 1;
}

/**
 * When Tier 2/3 edges are absent, synthesize estimates from Tier 1.
 * Safe with empty input — returns [].
 */
export function estimateDownstreamTiers(
  tier1: SupplyChainNodeInput[],
  config: TierEstimateConfig = DEFAULT_TIER_ESTIMATE,
): SupplyChainNodeInput[] {
  if (!Array.isArray(tier1) || tier1.length === 0) return [];

  const out: SupplyChainNodeInput[] = [];

  for (const parent of tier1) {
    if (parent.tier !== 1) continue;
    const locFactor = locationIntensityFactor(parent.location);
    const n2 = Math.max(0, Math.min(config.maxTier2PerParent, 2));

    for (let i = 0; i < n2; i++) {
      const tier2Id = `est-t2-${parent.id}-${i + 1}`;
      const tier2: SupplyChainNodeInput = {
        id: tier2Id,
        name: `Upstream of ${parent.name} (${i + 1})`,
        tier: 2,
        spend: Math.max(0, parent.spend * config.spendFactor),
        emissions: Math.max(
          0,
          parent.emissions * config.tier2EmissionsFactor * locFactor,
        ),
        scope: "Scope3",
        location: parent.location ?? null,
        category: parent.category ?? null,
        estimated: true,
        parentId: parent.id,
        relationshipStrength: "medium",
        supplierId: null,
      };
      out.push(tier2);

      const n3 = Math.max(0, Math.min(config.maxTier3PerParent, 1));
      for (let j = 0; j < n3; j++) {
        out.push({
          id: `est-t3-${parent.id}-${i + 1}-${j + 1}`,
          name: `Raw material · ${parent.name}`,
          tier: 3,
          spend: Math.max(0, tier2.spend * config.spendFactor),
          emissions: Math.max(
            0,
            tier2.emissions * config.tier3EmissionsFactor * locFactor,
          ),
          scope: "Scope3",
          location: parent.location ?? null,
          category: parent.category ?? "other",
          estimated: true,
          parentId: tier2Id,
          relationshipStrength: "low",
          supplierId: null,
        });
      }
    }
  }

  return out;
}

/**
 * Merge persisted nodes with estimates. Persisted tiers win; estimates fill gaps.
 */
export function mergeWithEstimates(
  persisted: SupplyChainNodeInput[],
  estimateConfig?: TierEstimateConfig,
): SupplyChainNodeInput[] {
  const safe = Array.isArray(persisted) ? persisted.filter((n) => n && n.id) : [];
  const hasDownstream = safe.some((n) => n.tier >= 2);
  if (hasDownstream) return safe.map(normalizeNode);

  const tier1 = safe.filter((n) => n.tier === 1).map(normalizeNode);
  const estimates = estimateDownstreamTiers(tier1, estimateConfig);
  return [...tier1, ...estimates];
}

function normalizeNode(n: SupplyChainNodeInput): SupplyChainNodeInput {
  return {
    ...n,
    tier: clampTier(n.tier),
    spend: Number.isFinite(n.spend) && n.spend > 0 ? n.spend : 0,
    emissions: Number.isFinite(n.emissions) && n.emissions > 0 ? n.emissions : 0,
    scope: parseScope(n.scope),
    estimated: Boolean(n.estimated),
  };
}

export function filterByTiers(
  nodes: SupplyChainNodeInput[],
  visibleTiers: number[] | "all",
): SupplyChainNodeInput[] {
  if (visibleTiers === "all") return nodes;
  const set = new Set(visibleTiers.map((t) => clampTier(t)));
  return nodes.filter((n) => set.has(clampTier(n.tier)));
}

function sizeRadius(
  value: number,
  maxValue: number,
  tier: number,
  mode: SizeMode,
): number {
  const base = mode === "emissions" ? 10 : 9;
  const tierShrink = tier <= 1 ? 1 : tier === 2 ? 0.7 : 0.45;
  if (!(maxValue > 0) || !(value > 0)) return Math.max(4, base * tierShrink * 0.55);
  const ratio = Math.sqrt(value / maxValue);
  return Math.max(4, Math.min(22, (base + ratio * 14) * tierShrink));
}

function tierOpacity(tier: number): number {
  if (tier <= 1) return 1;
  if (tier === 2) return 0.72;
  return 0.5;
}

function ringRadius(tier: number, cx: number): number {
  const step = Math.min(cx * 0.28, 110);
  return step * Math.max(1, tier);
}

function strengthWeight(s: RelationshipStrength | null | undefined): number {
  if (s === "critical") return 1;
  if (s === "high") return 0.75;
  if (s === "medium") return 0.5;
  if (s === "low") return 0.3;
  return 0.4;
}

/**
 * Radial ring layout: org center, Tier N on ring N.
 * Connection thickness from sizeMode share.
 */
export function layoutRadialGraph(opts: {
  orgName: string;
  nodes: SupplyChainNodeInput[];
  sizeMode?: SizeMode;
  width?: number;
  height?: number;
}): RadialLayout {
  const width = opts.width ?? 720;
  const height = opts.height ?? 560;
  const sizeMode = opts.sizeMode ?? "emissions";
  const cx = width / 2;
  const cy = height / 2;

  const nodes = (opts.nodes ?? []).map(normalizeNode);
  const maxValue = Math.max(
    0,
    ...nodes.map((n) => (sizeMode === "emissions" ? n.emissions : n.spend)),
  );

  const byTier = new Map<number, SupplyChainNodeInput[]>();
  for (const n of nodes) {
    const list = byTier.get(n.tier) ?? [];
    list.push(n);
    byTier.set(n.tier, list);
  }

  const laid: LaidOutNode[] = [];
  const idSet = new Set(nodes.map((n) => n.id));

  for (const [tier, group] of byTier) {
    const r = ringRadius(tier, cx);
    const count = group.length;
    group.forEach((n, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(count, 1);
      const value = sizeMode === "emissions" ? n.emissions : n.spend;
      laid.push({
        ...n,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        radius: sizeRadius(value, maxValue, n.tier, sizeMode),
        colorVar: scopeColorVar(n.scope),
        opacity: tierOpacity(n.tier),
      });
    });
  }

  const totalSpend = nodes.reduce((s, n) => s + n.spend, 0);
  const totalEmissions = nodes.reduce((s, n) => s + n.emissions, 0);
  const shareBase = sizeMode === "emissions" ? totalEmissions : totalSpend;

  const links: LaidOutLink[] = [];
  for (const n of nodes) {
    let sourceId = "org";
    if (n.parentId && idSet.has(n.parentId)) {
      sourceId = n.parentId;
    } else if (n.tier > 1) {
      // Fallback: connect toward center when parent missing
      sourceId = "org";
    }
    const share =
      shareBase > 0 ? (sizeMode === "emissions" ? n.emissions : n.spend) / shareBase : 0;
    links.push({
      sourceId,
      targetId: n.id,
      weight: share,
      strength: strengthWeight(n.relationshipStrength),
    });
  }

  const tierCounts: Record<number, number> = {};
  for (const n of nodes) {
    tierCounts[n.tier] = (tierCounts[n.tier] ?? 0) + 1;
  }

  return {
    nodes: laid,
    links,
    center: {
      id: "org",
      label: opts.orgName || "Organisation",
      x: cx,
      y: cy,
      radius: 28,
    },
    stats: {
      totalSuppliers: nodes.length,
      totalSpend,
      totalEmissions,
      tierCounts,
      estimatedCount: nodes.filter((n) => n.estimated).length,
    },
    viewBox: { width, height },
  };
}

export function networkToCsvRows(
  orgName: string,
  nodes: SupplyChainNodeInput[],
): string[][] {
  const header = [
    "organisation",
    "node_id",
    "name",
    "tier",
    "scope",
    "spend",
    "emissions_tco2e",
    "location",
    "category",
    "estimated",
    "parent_id",
    "relationship_strength",
    "supplier_id",
  ];
  const rows = nodes.map((n) => [
    orgName,
    n.id,
    n.name,
    String(n.tier),
    n.scope,
    String(n.spend),
    String(n.emissions),
    n.location ?? "",
    n.category ?? "",
    n.estimated ? "true" : "false",
    n.parentId ?? "",
    n.relationshipStrength ?? "",
    n.supplierId ?? "",
  ]);
  return [header, ...rows];
}

export function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function networkToCsv(orgName: string, nodes: SupplyChainNodeInput[]): string {
  return networkToCsvRows(orgName, nodes)
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export function applyTierUpdates(
  nodes: SupplyChainNodeInput[],
  updates: Array<{
    id: string;
    tier?: number;
    parentId?: string | null;
    scope?: SupplyChainScope;
    relationshipStrength?: RelationshipStrength | null;
  }>,
  maxTier = DEFAULT_MAX_TIER,
): SupplyChainNodeInput[] {
  const map = new Map(nodes.map((n) => [n.id, { ...n }]));
  for (const u of updates) {
    const existing = map.get(u.id);
    if (!existing) continue;
    if (u.tier !== undefined) existing.tier = clampTier(u.tier, maxTier);
    if (u.parentId !== undefined) existing.parentId = u.parentId;
    if (u.scope !== undefined) existing.scope = parseScope(u.scope);
    if (u.relationshipStrength !== undefined) {
      existing.relationshipStrength = u.relationshipStrength;
    }
    // Manual tier assignment is no longer a soft estimate
    if (u.tier !== undefined || u.parentId !== undefined) {
      existing.estimated = false;
    }
    map.set(u.id, existing);
  }
  return [...map.values()];
}
