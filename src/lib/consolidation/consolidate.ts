/**
 * Multi-org emissions consolidation — pure functions, zero I/O.
 * Ownership multiplies along the ancestor path (parent × child × …).
 */

export type ConsolidationMethod = "full" | "proportional" | "equity";

export const CONSOLIDATION_METHODS: ConsolidationMethod[] = [
  "full",
  "proportional",
  "equity",
];

export const CONSOLIDATION_METHOD_LABELS: Record<ConsolidationMethod, string> = {
  full: "Full (100%)",
  proportional: "Proportional (ownership %)",
  equity: "Equity share",
};

export type HierarchyOrg = {
  id: string;
  name: string;
  /** Explicit consolidation parent — never inferred from consultancy parentOrg. */
  parentId: string | null;
  consolidationMethod: ConsolidationMethod;
  /** Parent ownership of this org, 0–100. */
  ownershipPercent: number;
};

export type OrgEmissionsSlice = {
  organisationId: string;
  scope1: number;
  scope2: number;
  scope3: number;
  /** Category / metric breakdown (Scope 3 cats, fuel types, etc.). */
  byCategory: Array<{ category: string; emissions: number }>;
  hasData: boolean;
};

export type ConsolidatedOrgRow = {
  organisationId: string;
  organisationName: string;
  depth: number;
  parentId: string | null;
  consolidationMethod: ConsolidationMethod;
  ownershipPercent: number;
  /** Product of ownership factors from root → this org (1 for root). */
  pathFactor: number;
  raw: { scope1: number; scope2: number; scope3: number; total: number };
  consolidated: { scope1: number; scope2: number; scope3: number; total: number };
  hasData: boolean;
};

export type ConsolidatedCategoryRow = {
  category: string;
  emissions: number;
};

export type ConsolidationResult = {
  parentOrganisationId: string;
  parentOrganisationName: string;
  period: string;
  total: number;
  byScope: { scope1: number; scope2: number; scope3: number };
  byOrg: ConsolidatedOrgRow[];
  byCategory: ConsolidatedCategoryRow[];
  /** Subsidiaries with no calculable emissions for the period. */
  unconsolidatedChildList: Array<{
    organisationId: string;
    organisationName: string;
    reason: string;
  }>;
  /** Distinct methods used on included subsidiaries (for report footer). */
  methodsUsed: ConsolidationMethod[];
  warnings: string[];
};

export type HierarchyTreeNode = {
  id: string;
  name: string;
  consolidationMethod: ConsolidationMethod;
  ownershipPercent: number;
  depth: number;
  children: HierarchyTreeNode[];
};

export function isConsolidationMethod(value: unknown): value is ConsolidationMethod {
  return typeof value === "string" && (CONSOLIDATION_METHODS as string[]).includes(value);
}

/** Ownership factor applied at a single parent→child link. */
export function linkOwnershipFactor(
  method: ConsolidationMethod,
  ownershipPercent: number,
): number {
  const pct = Number.isFinite(ownershipPercent)
    ? Math.min(100, Math.max(0, ownershipPercent))
    : 100;
  if (method === "full") return 1;
  return pct / 100;
}

/**
 * True if setting `childId`'s parent to `newParentId` would create a cycle
 * (A → B → A) or self-parent.
 */
export function wouldCreateCircularHierarchy(
  orgs: HierarchyOrg[],
  childId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === childId) return true;

  const byId = new Map(orgs.map((o) => [o.id, o]));
  // Walk ancestors of the proposed parent; if we hit childId, cycle.
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === childId) return true;
    if (seen.has(cursor)) return true; // existing cycle in data
    seen.add(cursor);
    const node = byId.get(cursor);
    cursor = node?.parentId ?? null;
  }
  return false;
}

/** Detect any cycle already present in the graph. */
export function findCircularOrgs(orgs: HierarchyOrg[]): string[] {
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const cyclic = new Set<string>();

  for (const org of orgs) {
    const path: string[] = [];
    const seen = new Set<string>();
    let cursor: string | null = org.id;
    while (cursor) {
      if (seen.has(cursor)) {
        const cycleStart = path.indexOf(cursor);
        for (const id of path.slice(cycleStart >= 0 ? cycleStart : 0)) {
          cyclic.add(id);
        }
        cyclic.add(cursor);
        break;
      }
      seen.add(cursor);
      path.push(cursor);
      const node = byId.get(cursor);
      cursor = node?.parentId ?? null;
    }
  }

  return [...cyclic];
}

/** Direct children with an explicit parentId pointing at parentId. */
export function findDirectChildren(
  orgs: HierarchyOrg[],
  parentId: string,
): HierarchyOrg[] {
  return orgs.filter((o) => o.parentId === parentId);
}

/**
 * Recursive descendants via explicit parentOrganisation links only.
 * Order: depth-first, parents before children.
 */
export function findDescendants(orgs: HierarchyOrg[], rootId: string): HierarchyOrg[] {
  const result: HierarchyOrg[] = [];
  const stack = [...findDirectChildren(orgs, rootId)].reverse();
  const visited = new Set<string>([rootId]);

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    result.push(node);
    const kids = findDirectChildren(orgs, node.id);
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push(kids[i]!);
    }
  }

  return result;
}

/**
 * Path ownership factor from root → org (product of link factors).
 * Root itself is always 1.
 */
export function pathOwnershipFactor(
  orgs: HierarchyOrg[],
  rootId: string,
  orgId: string,
): number {
  if (orgId === rootId) return 1;
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const chain: HierarchyOrg[] = [];
  let cursor: string | null = orgId;
  const seen = new Set<string>();

  while (cursor && cursor !== rootId) {
    if (seen.has(cursor)) return 0;
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) return 0;
    chain.push(node);
    cursor = node.parentId;
  }
  if (cursor !== rootId) return 0;

  // chain is org → … → child-of-root; multiply each link factor
  let factor = 1;
  for (const node of chain) {
    factor *= linkOwnershipFactor(node.consolidationMethod, node.ownershipPercent);
  }
  return factor;
}

function depthFromRoot(orgs: HierarchyOrg[], rootId: string, orgId: string): number {
  if (orgId === rootId) return 0;
  const byId = new Map(orgs.map((o) => [o.id, o]));
  let depth = 0;
  let cursor: string | null = orgId;
  const seen = new Set<string>();
  while (cursor && cursor !== rootId) {
    if (seen.has(cursor)) return depth;
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) return depth;
    depth += 1;
    cursor = node.parentId;
  }
  return depth;
}

/**
 * Consolidate emissions for a parent and all explicitly linked descendants.
 * Parent own emissions always included at 100%. Children scaled by path factor.
 * Orgs without Membership should be filtered out by the caller before calling.
 */
export function consolidateEmissions(input: {
  parentId: string;
  period: string;
  orgs: HierarchyOrg[];
  emissions: OrgEmissionsSlice[];
}): ConsolidationResult {
  const { parentId, period, orgs, emissions } = input;
  const parent = orgs.find((o) => o.id === parentId);
  const parentName = parent?.name ?? parentId;
  const emissionsByOrg = new Map(emissions.map((e) => [e.organisationId, e]));
  const descendants = findDescendants(orgs, parentId);
  const included = [parent, ...descendants].filter((o): o is HierarchyOrg => Boolean(o));

  const byOrg: ConsolidatedOrgRow[] = [];
  const categoryMap = new Map<string, number>();
  const unconsolidatedChildList: ConsolidationResult["unconsolidatedChildList"] = [];
  const methodsUsed = new Set<ConsolidationMethod>();
  const warnings: string[] = [];

  let scope1 = 0;
  let scope2 = 0;
  let scope3 = 0;

  for (const org of included) {
    const factor = pathOwnershipFactor(orgs, parentId, org.id);
    const slice = emissionsByOrg.get(org.id);
    const rawScope1 = slice?.scope1 ?? 0;
    const rawScope2 = slice?.scope2 ?? 0;
    const rawScope3 = slice?.scope3 ?? 0;
    const rawTotal = rawScope1 + rawScope2 + rawScope3;
    const hasData = Boolean(slice?.hasData && rawTotal > 0);

    if (org.id !== parentId) {
      methodsUsed.add(org.consolidationMethod);
      if (!hasData) {
        unconsolidatedChildList.push({
          organisationId: org.id,
          organisationName: org.name,
          reason: "No calculable emissions for this period",
        });
        warnings.push(
          `${org.name} has no data for ${period} and cannot contribute to consolidation.`,
        );
      }
    }

    const cScope1 = rawScope1 * factor;
    const cScope2 = rawScope2 * factor;
    const cScope3 = rawScope3 * factor;
    const cTotal = cScope1 + cScope2 + cScope3;

    scope1 += cScope1;
    scope2 += cScope2;
    scope3 += cScope3;

    byOrg.push({
      organisationId: org.id,
      organisationName: org.name,
      depth: depthFromRoot(orgs, parentId, org.id),
      parentId: org.parentId,
      consolidationMethod: org.consolidationMethod,
      ownershipPercent: org.ownershipPercent,
      pathFactor: factor,
      raw: {
        scope1: rawScope1,
        scope2: rawScope2,
        scope3: rawScope3,
        total: rawTotal,
      },
      consolidated: {
        scope1: cScope1,
        scope2: cScope2,
        scope3: cScope3,
        total: cTotal,
      },
      hasData,
    });

    const cats = slice?.byCategory ?? [];
    for (const row of cats) {
      const key = row.category || "uncategorised";
      categoryMap.set(key, (categoryMap.get(key) ?? 0) + row.emissions * factor);
    }
    // If no category rows but scopes exist, synthesise scope buckets
    if (cats.length === 0 && hasData) {
      if (rawScope1 > 0) {
        categoryMap.set(
          "Scope 1",
          (categoryMap.get("Scope 1") ?? 0) + rawScope1 * factor,
        );
      }
      if (rawScope2 > 0) {
        categoryMap.set(
          "Scope 2",
          (categoryMap.get("Scope 2") ?? 0) + rawScope2 * factor,
        );
      }
      if (rawScope3 > 0) {
        categoryMap.set(
          "Scope 3",
          (categoryMap.get("Scope 3") ?? 0) + rawScope3 * factor,
        );
      }
    }
  }

  const byCategory = [...categoryMap.entries()]
    .map(([category, emissionsValue]) => ({
      category,
      emissions: emissionsValue,
    }))
    .sort((a, b) => b.emissions - a.emissions);

  return {
    parentOrganisationId: parentId,
    parentOrganisationName: parentName,
    period,
    total: scope1 + scope2 + scope3,
    byScope: { scope1, scope2, scope3 },
    byOrg,
    byCategory,
    unconsolidatedChildList,
    methodsUsed: [...methodsUsed],
    warnings,
  };
}

/**
 * Build a forest of hierarchy trees, filtered to accessible org ids.
 * Orgs without an accessible parent become roots of their own subtree.
 */
export function buildHierarchyForest(
  orgs: HierarchyOrg[],
  accessibleIds: Set<string>,
): HierarchyTreeNode[] {
  const accessible = orgs.filter((o) => accessibleIds.has(o.id));
  const accessibleSet = new Set(accessible.map((o) => o.id));

  function childrenOf(parentId: string, depth: number): HierarchyTreeNode[] {
    return accessible
      .filter((o) => o.parentId === parentId)
      .map((o) => ({
        id: o.id,
        name: o.name,
        consolidationMethod: o.consolidationMethod,
        ownershipPercent: o.ownershipPercent,
        depth,
        children: childrenOf(o.id, depth + 1),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Roots: no parent, or parent not in accessible set
  const roots = accessible.filter((o) => !o.parentId || !accessibleSet.has(o.parentId));

  return roots
    .map((o) => ({
      id: o.id,
      name: o.name,
      consolidationMethod: o.consolidationMethod,
      ownershipPercent: o.ownershipPercent,
      depth: 0,
      children: childrenOf(o.id, 1),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Flatten forest to indented switcher options (Membership-filtered). */
export function flattenHierarchyForSwitcher(
  forest: HierarchyTreeNode[],
): Array<{ id: string; name: string; depth: number; label: string }> {
  const rows: Array<{ id: string; name: string; depth: number; label: string }> = [];

  function walk(nodes: HierarchyTreeNode[]) {
    for (const n of nodes) {
      const indent = n.depth > 0 ? `${"\u00A0".repeat(n.depth * 2)}↳ ` : "";
      rows.push({
        id: n.id,
        name: n.name,
        depth: n.depth,
        label: `${indent}${n.name}`,
      });
      walk(n.children);
    }
  }

  walk(forest);
  return rows;
}

/** CSV for consolidated report with subsidiary breakdown. */
export function consolidatedReportToCsv(result: ConsolidationResult): string {
  const lines: string[] = [];
  const esc = (v: string | number) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  lines.push(
    [
      "organisation",
      "depth",
      "ownership_percent",
      "path_factor",
      "method",
      "scope1_raw",
      "scope2_raw",
      "scope3_raw",
      "total_raw",
      "scope1_consolidated",
      "scope2_consolidated",
      "scope3_consolidated",
      "total_consolidated",
      "has_data",
    ].join(","),
  );

  for (const row of result.byOrg) {
    lines.push(
      [
        esc(row.organisationName),
        row.depth,
        row.ownershipPercent,
        row.pathFactor,
        row.consolidationMethod,
        row.raw.scope1,
        row.raw.scope2,
        row.raw.scope3,
        row.raw.total,
        row.consolidated.scope1,
        row.consolidated.scope2,
        row.consolidated.scope3,
        row.consolidated.total,
        row.hasData ? "yes" : "no",
      ].join(","),
    );
  }

  lines.push("");
  lines.push("category,emissions_consolidated");
  for (const cat of result.byCategory) {
    lines.push([esc(cat.category), cat.emissions].join(","));
  }

  lines.push("");
  lines.push(
    `total,${result.total},period,${esc(result.period)},methods,${esc(
      result.methodsUsed.map((m) => CONSOLIDATION_METHOD_LABELS[m]).join("; ") ||
        "Parent only",
    )}`,
  );

  return `${lines.join("\n")}\n`;
}

export function formatConsolidationFooter(result: ConsolidationResult): string {
  const methods =
    result.methodsUsed.length > 0
      ? result.methodsUsed.map((m) => CONSOLIDATION_METHOD_LABELS[m]).join("; ")
      : "Parent only (no subsidiaries)";
  return `Consolidation method(s): ${methods}. Ownership applied along the hierarchy path. Subsidiaries without data are listed but contribute zero.`;
}
