/**
 * Facility hierarchy helpers — pure, zero I/O.
 * Operational sites only; not legal-entity consolidation.
 */

import type {
  FacilityNode,
  FacilityRollup,
  FacilityTreeNode,
  MeterRow,
  MeterUtility,
} from "./types";
import { METER_UTILITIES } from "./types";

function emptyByUtility(): Record<MeterUtility, number> {
  return {
    electricity: 0,
    gas: 0,
    water: 0,
    heat: 0,
  };
}

/**
 * True if setting `childId`'s parent to `newParentId` would create a cycle
 * (A → B → A) or self-parent.
 */
export function wouldCreateCircularFacility(
  facilities: Array<{ id: string; parentId: string | null }>,
  childId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === childId) return true;

  const byId = new Map(facilities.map((f) => [f.id, f]));
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === childId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    const node = byId.get(cursor);
    cursor = node?.parentId ?? null;
  }
  return false;
}

/**
 * Build a forest of facility trees. Nodes whose parent is missing become roots.
 * meterCount on each node is meters attached to that facility only (not rolled up).
 */
export function buildFacilityForest(
  facilities: FacilityNode[],
  meters: MeterRow[] = [],
): FacilityTreeNode[] {
  const meterCountByFacility = new Map<string, number>();
  for (const m of meters) {
    meterCountByFacility.set(
      m.facilityId,
      (meterCountByFacility.get(m.facilityId) ?? 0) + 1,
    );
  }

  const byId = new Map(facilities.map((f) => [f.id, f]));
  const ids = new Set(byId.keys());

  function childrenOf(parentId: string, depth: number): FacilityTreeNode[] {
    return facilities
      .filter((f) => f.parentId === parentId)
      .map((f) => toTreeNode(f, depth))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function toTreeNode(f: FacilityNode, depth: number): FacilityTreeNode {
    return {
      ...f,
      depth,
      meterCount: meterCountByFacility.get(f.id) ?? 0,
      children: childrenOf(f.id, depth + 1),
    };
  }

  const roots = facilities.filter((f) => !f.parentId || !ids.has(f.parentId));

  return roots.map((f) => toTreeNode(f, 0)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Flatten forest to indented rows for selects / lists. */
export function flattenFacilityForest(forest: FacilityTreeNode[]): Array<{
  id: string;
  name: string;
  code: string;
  depth: number;
  label: string;
  meterCount: number;
  active: boolean;
  facilityType: FacilityTreeNode["facilityType"];
}> {
  const rows: Array<{
    id: string;
    name: string;
    code: string;
    depth: number;
    label: string;
    meterCount: number;
    active: boolean;
    facilityType: FacilityTreeNode["facilityType"];
  }> = [];

  function walk(nodes: FacilityTreeNode[]) {
    for (const n of nodes) {
      const indent = n.depth > 0 ? `${"\u00A0".repeat(n.depth * 2)}↳ ` : "";
      rows.push({
        id: n.id,
        name: n.name,
        code: n.code,
        depth: n.depth,
        label: `${indent}${n.name} (${n.code})`,
        meterCount: n.meterCount,
        active: n.active,
        facilityType: n.facilityType,
      });
      walk(n.children);
    }
  }

  walk(forest);
  return rows;
}

/**
 * Roll up descendant + meter counts for each facility (self-inclusive).
 * Useful for hierarchy summaries without Payload I/O.
 */
export function rollupFacilityMeters(
  facilities: FacilityNode[],
  meters: MeterRow[],
): FacilityRollup[] {
  const forest = buildFacilityForest(facilities, meters);
  const metersByFacility = new Map<string, MeterRow[]>();
  for (const m of meters) {
    const list = metersByFacility.get(m.facilityId) ?? [];
    list.push(m);
    metersByFacility.set(m.facilityId, list);
  }

  const results: FacilityRollup[] = [];

  function walk(nodes: FacilityTreeNode[]): {
    descendantCount: number;
    meterCount: number;
    activeMeterCount: number;
    byUtility: Record<MeterUtility, number>;
  } {
    let descendantCount = 0;
    let meterCount = 0;
    let activeMeterCount = 0;
    const byUtility = emptyByUtility();

    for (const n of nodes) {
      const ownMeters = metersByFacility.get(n.id) ?? [];
      const ownMeterCount = ownMeters.length;
      let ownActive = 0;
      const ownByUtility = emptyByUtility();
      for (const m of ownMeters) {
        if (m.active) ownActive += 1;
        ownByUtility[m.utility] += 1;
      }

      const child = walk(n.children);
      const totalDescendants = 1 + child.descendantCount;
      const totalMeters = ownMeterCount + child.meterCount;
      const totalActive = ownActive + child.activeMeterCount;
      const totalByUtility = emptyByUtility();
      for (const u of METER_UTILITIES) {
        totalByUtility[u] = ownByUtility[u] + child.byUtility[u];
      }

      results.push({
        id: n.id,
        name: n.name,
        code: n.code,
        depth: n.depth,
        descendantCount: totalDescendants,
        meterCount: totalMeters,
        activeMeterCount: totalActive,
        byUtility: totalByUtility,
      });

      descendantCount += totalDescendants;
      meterCount += totalMeters;
      activeMeterCount += totalActive;
      for (const u of METER_UTILITIES) {
        byUtility[u] += totalByUtility[u];
      }
    }

    return { descendantCount, meterCount, activeMeterCount, byUtility };
  }

  walk(forest);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Collect self + all descendant facility ids. */
export function collectDescendantIds(
  facilities: Array<{ id: string; parentId: string | null }>,
  rootId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const f of facilities) {
    if (!f.parentId) continue;
    const list = childrenByParent.get(f.parentId) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parentId, list);
  }

  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    const kids = childrenByParent.get(id) ?? [];
    for (const k of kids) stack.push(k);
  }
  return out;
}
