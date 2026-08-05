/**
 * Consolidation service — Payload I/O around pure consolidate.ts.
 */

import type { Payload } from "payload";

import { resolveOrgBaselineByScope } from "@/lib/analytics/resolveOrgBaseline";

import {
  applyIcEliminations,
  buildHierarchyForest,
  consolidateEmissions,
  consolidatedReportToCsv,
  formatConsolidationFooter,
  isConsolidationMethod,
  recomputeConsolidationAggregates,
  wouldCreateCircularHierarchy,
  type ConsolidationMethod,
  type ConsolidationResult,
  type HierarchyOrg,
  type HierarchyTreeNode,
  type IcEliminationLine,
  type OrgEmissionsSlice,
} from "./consolidate";

export type ConsolidationPack = "management" | "statutory";

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : String(id);
  }
  return null;
}

function asMethod(value: unknown): ConsolidationMethod {
  return isConsolidationMethod(value) ? value : "full";
}

function asOwnership(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, value));
  }
  return 100;
}

export function orgDocToHierarchy(doc: {
  id: string;
  name?: string | null;
  parentOrganisation?: unknown;
  consolidationMethod?: unknown;
  ownershipPercent?: unknown;
}): HierarchyOrg {
  return {
    id: String(doc.id),
    name: String(doc.name ?? doc.id),
    parentId: relId(doc.parentOrganisation),
    consolidationMethod: asMethod(doc.consolidationMethod),
    ownershipPercent: asOwnership(doc.ownershipPercent),
  };
}

/** Load hierarchy nodes. When ids provided, only those orgs; else all (caller must filter). */
export async function loadHierarchyOrgs(
  payload: Payload,
  ids?: string[],
): Promise<HierarchyOrg[]> {
  if (ids && ids.length === 0) return [];

  const result = await payload.find({
    collection: "organisations",
    where: ids ? { id: { in: ids } } : undefined,
    depth: 0,
    limit: ids ? Math.max(ids.length, 1) : 500,
    overrideAccess: true,
  });

  // Also load any parents referenced so cycle detection / path factors work
  const nodes = result.docs.map(orgDocToHierarchy);
  const known = new Set(nodes.map((n) => n.id));
  const missingParents = nodes
    .map((n) => n.parentId)
    .filter((pid): pid is string => typeof pid === "string" && !known.has(pid));

  if (missingParents.length > 0) {
    const parents = await payload.find({
      collection: "organisations",
      where: { id: { in: [...new Set(missingParents)] } },
      depth: 0,
      limit: missingParents.length,
      overrideAccess: true,
    });
    for (const doc of parents.docs) {
      nodes.push(orgDocToHierarchy(doc));
    }
  }

  // For consolidation of accessible orgs we also need all descendants of roots
  // that point at accessible parents — load children by parentOrganisation.
  if (ids && ids.length > 0) {
    const children = await payload.find({
      collection: "organisations",
      where: { parentOrganisation: { in: ids } },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    });
    const have = new Set(nodes.map((n) => n.id));
    for (const doc of children.docs) {
      if (have.has(String(doc.id))) continue;
      nodes.push(orgDocToHierarchy(doc));
      have.add(String(doc.id));
    }

    // One more level for grandchildren (bounded — recursive fetch in loop)
    let frontier = children.docs.map((d) => String(d.id));
    for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
      const next = await payload.find({
        collection: "organisations",
        where: { parentOrganisation: { in: frontier } },
        depth: 0,
        limit: 500,
        overrideAccess: true,
      });
      frontier = [];
      for (const doc of next.docs) {
        const id = String(doc.id);
        if (have.has(id)) continue;
        nodes.push(orgDocToHierarchy(doc));
        have.add(id);
        frontier.push(id);
      }
    }
  }

  return nodes;
}

async function loadCategoryBreakdown(
  payload: Payload,
  organisationId: string,
  periodId: string | null,
): Promise<Array<{ category: string; emissions: number }>> {
  if (!periodId) return [];

  const activities = await payload.find({
    collection: "scope3-activities",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { equals: periodId } },
        { status: { in: ["validated", "approved"] } },
      ],
    },
    depth: 1,
    limit: 500,
    overrideAccess: true,
  });

  const byCat = new Map<string, number>();
  for (const act of activities.docs) {
    const source =
      typeof act.source === "object" && act.source !== null ? act.source : null;
    const category =
      source && "name" in source && source.name ? String(source.name) : "Scope 3";
    const value = Number(act.calculatedEmissions) || 0;
    byCat.set(category, (byCat.get(category) ?? 0) + value);
  }

  return [...byCat.entries()].map(([category, emissions]) => ({
    category,
    emissions,
  }));
}

export async function loadOrgEmissionsSlice(
  payload: Payload,
  organisationId: string,
  year: number,
): Promise<OrgEmissionsSlice> {
  const resolved = await resolveOrgBaselineByScope(payload, organisationId, year);
  const byCategory = await loadCategoryBreakdown(
    payload,
    organisationId,
    resolved.periodId,
  );

  const total =
    resolved.baseline.scope1 + resolved.baseline.scope2 + resolved.baseline.scope3;

  return {
    organisationId,
    scope1: resolved.baseline.scope1,
    scope2: resolved.baseline.scope2,
    scope3: resolved.baseline.scope3,
    byCategory,
    hasData: resolved.quality === "calculated" && total > 0,
  };
}

export async function getHierarchyTree(
  payload: Payload,
  accessibleOrgIds: string[],
): Promise<{ forest: HierarchyTreeNode[]; orgs: HierarchyOrg[] }> {
  const accessible = new Set(accessibleOrgIds);
  const orgs = await loadHierarchyOrgs(payload, accessibleOrgIds);
  // Only expose nodes the user can access
  const filtered = orgs.filter((o) => accessible.has(o.id));
  return {
    forest: buildHierarchyForest(filtered, accessible),
    orgs: filtered,
  };
}

export type SetHierarchyInput = {
  organisationId: string;
  parentOrganisationId: string | null;
  consolidationMethod: ConsolidationMethod;
  ownershipPercent: number;
};

export async function setOrganisationHierarchy(
  payload: Payload,
  input: SetHierarchyInput,
): Promise<{ org: HierarchyOrg } | { error: string; status: number }> {
  const { organisationId, parentOrganisationId, consolidationMethod, ownershipPercent } =
    input;

  if (!isConsolidationMethod(consolidationMethod)) {
    return {
      error: "consolidationMethod must be full, proportional, or equity.",
      status: 400,
    };
  }
  if (
    !Number.isFinite(ownershipPercent) ||
    ownershipPercent < 0 ||
    ownershipPercent > 100
  ) {
    return { error: "ownershipPercent must be between 0 and 100.", status: 400 };
  }

  // Load a broad set for cycle detection
  const orgs = await loadHierarchyOrgs(payload);

  if (wouldCreateCircularHierarchy(orgs, organisationId, parentOrganisationId)) {
    return {
      error: "Circular hierarchy rejected. An organisation cannot be its own ancestor.",
      status: 400,
    };
  }

  if (parentOrganisationId) {
    try {
      await payload.findByID({
        collection: "organisations",
        id: parentOrganisationId,
        depth: 0,
        overrideAccess: true,
      });
    } catch {
      return { error: "Parent organisation not found.", status: 404 };
    }
  }

  const updated = await payload.update({
    collection: "organisations",
    id: organisationId,
    data: {
      parentOrganisation: parentOrganisationId,
      consolidationMethod,
      ownershipPercent,
    },
    overrideAccess: true,
  });

  return { org: orgDocToHierarchy(updated) };
}

/**
 * Build consolidated report for parent.
 * Only includes subsidiaries present in accessibleOrgIds (Membership gate).
 */
export async function buildConsolidatedReport(
  payload: Payload,
  opts: {
    parentOrganisationId: string;
    periodYear: number;
    accessibleOrgIds: string[];
    pack?: ConsolidationPack;
    eliminations?: IcEliminationLine[];
  },
): Promise<
  ConsolidationResult & { footer: string; csv: string; pack: ConsolidationPack }
> {
  const accessible = new Set(opts.accessibleOrgIds);
  if (!accessible.has(opts.parentOrganisationId)) {
    throw new Error("Forbidden: no Membership on parent organisation.");
  }

  const pack: ConsolidationPack = opts.pack === "statutory" ? "statutory" : "management";

  // Full graph for path ownership (intermediates may be inaccessible).
  let graphOrgs = await loadHierarchyOrgs(payload, opts.accessibleOrgIds);
  const statutoryWarnings: string[] = [];
  if (pack === "statutory") {
    graphOrgs = graphOrgs.map((org) =>
      org.id === opts.parentOrganisationId || org.consolidationMethod === "full"
        ? org
        : { ...org, consolidationMethod: "full" as const },
    );
    statutoryWarnings.push(
      "Statutory pack: all subsidiaries consolidated at full (100%) method regardless of configured ownership, per statutory consolidation convention.",
    );
  }
  // Emissions + output rows: Membership only.
  const reportOrgs = graphOrgs.filter((o) => accessible.has(o.id));

  const period = String(opts.periodYear);
  const emissions: OrgEmissionsSlice[] = [];
  for (const org of reportOrgs) {
    emissions.push(await loadOrgEmissionsSlice(payload, org.id, opts.periodYear));
  }

  const result = consolidateEmissions({
    parentId: opts.parentOrganisationId,
    period,
    orgs: graphOrgs,
    emissions,
  });
  result.warnings = [...statutoryWarnings, ...result.warnings];

  // Never surface subsidiary rows without Membership
  result.byOrg = result.byOrg.filter((r) => accessible.has(r.organisationId));
  result.unconsolidatedChildList = result.unconsolidatedChildList.filter((u) =>
    accessible.has(u.organisationId),
  );
  result.warnings = result.warnings.filter(
    (w) =>
      result.byOrg.some(
        (r) =>
          !r.hasData &&
          (r.depth > 0 || r.organisationId === opts.parentOrganisationId) &&
          w.includes(r.organisationName),
      ) || result.unconsolidatedChildList.some((u) => w.includes(u.organisationName)),
  );

  // Recompute measured-only totals + quality after Membership filter
  const recomputed = recomputeConsolidationAggregates(result);
  const withEliminations = applyIcEliminations(recomputed, opts.eliminations ?? []);
  const footer = formatConsolidationFooter(withEliminations);
  const csv = consolidatedReportToCsv(withEliminations);

  return { ...withEliminations, footer, csv, pack };
}

export {
  consolidatedReportToCsv,
  formatConsolidationFooter,
  isConsolidationMethod,
  wouldCreateCircularHierarchy,
};
