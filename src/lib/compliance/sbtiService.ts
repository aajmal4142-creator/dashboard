import type { Payload } from "payload";

import { resolveOrgBaselineByScope } from "@/lib/analytics/resolveOrgBaseline";
import { checkSBTiAlignment } from "@/lib/analytics/pathwayPlanner";

import {
  applyScenarioReduction,
  calculateSbtiProgress,
  resolveTargetLevels,
  scenarioScopeToSbti,
  sbtiRegistrySearchUrl,
  sumScopedEmissions,
  type SbtiProgressResult,
  type SbtiScopeEmissions,
  type SbtiScopeKey,
} from "./sbtiProgress";

export type SbtiTargetType = "absolute" | "intensity";
export type SbtiTargetStatus = "draft" | "submitted" | "validated" | "approved";

export type SbtiTargetDoc = {
  id: string;
  name: string;
  targetType: SbtiTargetType;
  baselineYear: number;
  baselineEmissions: number;
  targetYear: number;
  targetEmissions?: number | null;
  reductionPercent?: number | null;
  scopesCovered: SbtiScopeKey[];
  status: SbtiTargetStatus;
  validationUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SbtiScenarioProjection = {
  scenarioId: string;
  scenarioName: string;
  reductionPercent: number;
  scopes: SbtiScopeKey[];
  projectedCurrent: number;
  progress: SbtiProgressResult;
};

export type SbtiTargetWithProgress = {
  target: SbtiTargetDoc;
  levels: { targetEmissions: number; reductionPercent: number };
  progress: SbtiProgressResult;
  currentByScope: SbtiScopeEmissions;
  currentQuality: "calculated" | "missing";
  currentMessage?: string;
  asOfYear: number;
  alignment: ReturnType<typeof checkSBTiAlignment>;
  registrySearchUrl: string;
  scenarios: SbtiScenarioProjection[];
};

const CREATE_STATUSES = new Set<SbtiTargetStatus>(["draft", "submitted"]);
const ALL_STATUSES = new Set<SbtiTargetStatus>([
  "draft",
  "submitted",
  "validated",
  "approved",
]);

export function parseScopesCovered(raw: unknown): SbtiScopeKey[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const allowed = new Set(["Scope1", "Scope2", "Scope3"]);
  const out: SbtiScopeKey[] = [];
  for (const item of raw) {
    const v = String(item);
    if (allowed.has(v) && !out.includes(v as SbtiScopeKey)) {
      out.push(v as SbtiScopeKey);
    }
  }
  return out.length > 0 ? out : null;
}

export function parseCreateStatus(raw: unknown): SbtiTargetStatus | null {
  const v = String(raw ?? "draft");
  if (v === "draft" || v === "submitted") return v;
  return null;
}

export function parseUpdateStatus(raw: unknown): SbtiTargetStatus | null {
  const v = String(raw ?? "");
  if (ALL_STATUSES.has(v as SbtiTargetStatus)) return v as SbtiTargetStatus;
  return null;
}

export function assertStatusTransition(
  from: SbtiTargetStatus,
  to: SbtiTargetStatus,
): string | null {
  if (from === to) return null;
  const order: SbtiTargetStatus[] = ["draft", "submitted", "validated", "approved"];
  const fromIdx = order.indexOf(from);
  const toIdx = order.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return "Invalid status";
  // Allow moving forward one step, or back to draft/submitted for edits
  if (to === "draft" || to === "submitted") return null;
  if (toIdx === fromIdx + 1) return null;
  if (toIdx > fromIdx + 1) {
    return `Cannot skip from ${from} to ${to}. Advance one step at a time.`;
  }
  return null;
}

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export function docToSbtiTarget(doc: {
  id: string;
  name?: string | null;
  targetType?: string | null;
  baselineYear?: number | null;
  baselineEmissions?: number | null;
  targetYear?: number | null;
  targetEmissions?: number | null;
  reductionPercent?: number | null;
  scopesCovered?: string[] | null;
  status?: string | null;
  validationUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}): SbtiTargetDoc {
  const scopes = parseScopesCovered(doc.scopesCovered) ?? ["Scope1", "Scope2"];
  const status = parseUpdateStatus(doc.status) ?? "draft";
  const targetType = doc.targetType === "intensity" ? "intensity" : "absolute";

  return {
    id: String(doc.id),
    name: String(doc.name ?? "SBTi target"),
    targetType,
    baselineYear: Number(doc.baselineYear),
    baselineEmissions: Number(doc.baselineEmissions),
    targetYear: Number(doc.targetYear),
    targetEmissions:
      doc.targetEmissions === null || doc.targetEmissions === undefined
        ? null
        : Number(doc.targetEmissions),
    reductionPercent:
      doc.reductionPercent === null || doc.reductionPercent === undefined
        ? null
        : Number(doc.reductionPercent),
    scopesCovered: scopes,
    status,
    validationUrl: doc.validationUrl ?? null,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function resolveLatestScopeYear(
  payload: Payload,
  organisationId: string,
  fallbackYear: number,
): Promise<number> {
  const periods = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    limit: 50,
    sort: "-endDate",
    overrideAccess: true,
  });
  if (periods.docs.length === 0) return fallbackYear;
  const end = periods.docs[0]?.endDate;
  if (!end) return fallbackYear;
  return new Date(String(end)).getFullYear() || fallbackYear;
}

/**
 * Load scoped emissions for a year and optionally convert to intensity
 * using organisation annualRevenue ($M).
 */
export async function loadCurrentMetric(args: {
  payload: Payload;
  organisationId: string;
  year: number;
  scopes: SbtiScopeKey[];
  targetType: SbtiTargetType;
}): Promise<{
  metric: number;
  byScope: SbtiScopeEmissions;
  quality: "calculated" | "missing";
  message?: string;
}> {
  const resolved = await resolveOrgBaselineByScope(
    args.payload,
    args.organisationId,
    args.year,
  );

  const byScope: SbtiScopeEmissions = {
    scope1: resolved.baseline.scope1,
    scope2: resolved.baseline.scope2,
    scope3: resolved.baseline.scope3,
  };
  let metric = sumScopedEmissions(byScope, args.scopes);

  if (args.targetType === "intensity") {
    const org = await args.payload.findByID({
      collection: "organisations",
      id: args.organisationId,
      depth: 0,
      overrideAccess: true,
    });
    const revenue = org.annualRevenue;
    if (revenue === null || revenue === undefined || !(Number(revenue) > 0)) {
      return {
        metric: 0,
        byScope,
        quality: "missing",
        message:
          "Intensity target requires organisation annualRevenue. Add revenue on the organisation to compute intensity progress.",
      };
    }
    const revenueMillions = Number(revenue) / 1_000_000;
    if (!(revenueMillions > 0)) {
      return {
        metric: 0,
        byScope,
        quality: "missing",
        message: "annualRevenue is too small to compute per-$M intensity.",
      };
    }
    metric = metric / revenueMillions;
  }

  return {
    metric,
    byScope,
    quality: resolved.quality,
    message: resolved.message,
  };
}

export async function buildTargetProgress(args: {
  payload: Payload;
  organisationId: string;
  orgName: string;
  target: SbtiTargetDoc;
  asOfYear?: number;
  includeScenarios?: boolean;
}): Promise<SbtiTargetWithProgress> {
  const asOfYear =
    args.asOfYear ??
    (await resolveLatestScopeYear(
      args.payload,
      args.organisationId,
      new Date().getFullYear(),
    ));

  const levels = resolveTargetLevels({
    baselineEmissions: args.target.baselineEmissions,
    targetEmissions: args.target.targetEmissions,
    reductionPercent: args.target.reductionPercent,
  });

  const current = await loadCurrentMetric({
    payload: args.payload,
    organisationId: args.organisationId,
    year: asOfYear,
    scopes: args.target.scopesCovered,
    targetType: args.target.targetType,
  });

  const progress = calculateSbtiProgress({
    baselineEmissions: args.target.baselineEmissions,
    targetEmissions: levels.targetEmissions,
    currentEmissions: current.metric,
    baselineYear: args.target.baselineYear,
    targetYear: args.target.targetYear,
    asOfYear,
  });

  const alignment = checkSBTiAlignment(
    args.target.baselineEmissions,
    levels.targetEmissions,
    args.target.baselineYear,
    args.target.targetYear,
  );

  const scenarios: SbtiScenarioProjection[] = [];
  if (args.includeScenarios !== false) {
    const scenarioDocs = await args.payload.find({
      collection: "scenarios",
      where: { organisation: { equals: args.organisationId } },
      limit: 20,
      sort: "-updatedAt",
      overrideAccess: true,
    });

    for (const s of scenarioDocs.docs) {
      const reduction = Number(s.reductionPercent ?? 0);
      if (!(reduction > 0)) continue;
      const scopes = scenarioScopeToSbti(
        Array.isArray(s.scopes) ? s.scopes.map(String) : ["1", "2", "3"],
      );
      if (scopes.length === 0) continue;

      let projectedAbsolute = applyScenarioReduction({
        currentByScope: current.byScope,
        scopesCovered: args.target.scopesCovered,
        scenarioReductionPercent: reduction,
        scenarioScopes: scopes,
      });

      if (args.target.targetType === "intensity" && current.metric > 0) {
        const absoluteNow = sumScopedEmissions(
          current.byScope,
          args.target.scopesCovered,
        );
        if (absoluteNow > 0) {
          const ratio = projectedAbsolute / absoluteNow;
          projectedAbsolute = current.metric * ratio;
        }
      } else if (args.target.targetType === "intensity") {
        // keep projected as absolute-derived intensity when current missing
        projectedAbsolute = current.metric;
      }

      const scenarioProgress = calculateSbtiProgress({
        baselineEmissions: args.target.baselineEmissions,
        targetEmissions: levels.targetEmissions,
        currentEmissions: projectedAbsolute,
        baselineYear: args.target.baselineYear,
        targetYear: args.target.targetYear,
        asOfYear,
      });

      scenarios.push({
        scenarioId: String(s.id),
        scenarioName: String(s.name ?? "Scenario"),
        reductionPercent: reduction,
        scopes,
        projectedCurrent: projectedAbsolute,
        progress: scenarioProgress,
      });
    }
  }

  return {
    target: {
      ...args.target,
      targetEmissions: levels.targetEmissions,
      reductionPercent: levels.reductionPercent,
    },
    levels,
    progress,
    currentByScope: current.byScope,
    currentQuality: current.quality,
    currentMessage: current.message,
    asOfYear,
    alignment,
    registrySearchUrl: sbtiRegistrySearchUrl(args.orgName),
    scenarios,
  };
}

export async function listOrgSbtiTargets(
  payload: Payload,
  organisationId: string,
): Promise<SbtiTargetDoc[]> {
  const result = await payload.find({
    collection: "sbti-targets",
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((d) => docToSbtiTarget(d));
}

export { relationId, CREATE_STATUSES };
