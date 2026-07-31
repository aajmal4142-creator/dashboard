/**
 * I/O helpers for decarbonization pathways (Payload + emissions load).
 */

import type { Payload } from "payload";

import {
  buildTimeline,
  calculatePathway,
  compareActualToPathway,
  type ActualProgressComparison,
  type FeasibilityResult,
  type InterventionTemplate,
  type PathwayMilestone,
  type PathwayPlanResult,
  type PathwayScope,
  type PathwayTimelinePoint,
  parseMilestoneStatus,
  parsePathwayScope,
} from "./pathwayPlanner";
import { resolveOrgBaselineByScope } from "./resolveOrgBaseline";

export type PathwayDocMilestone = {
  year: number;
  action: string;
  emissionsSaved: number;
  cost?: number | null;
  status: "planned" | "in_progress" | "completed" | "missed";
  scope?: PathwayScope | null;
  cumulativeEmissionsSaved?: number | null;
  pathwayEmissions?: number | null;
  id?: string | null;
};

export function milestonesFromPlan(plan: PathwayPlanResult): PathwayDocMilestone[] {
  return plan.milestones.map((m) => ({
    year: m.year,
    action: m.action,
    emissionsSaved: m.emissionsSaved,
    cost: m.cost,
    status: m.status,
    scope: m.scope,
    cumulativeEmissionsSaved: m.cumulativeEmissionsSaved,
    pathwayEmissions: m.pathwayEmissions,
  }));
}

export function docMilestonesToPure(
  docs: PathwayDocMilestone[] | null | undefined,
): PathwayMilestone[] {
  if (!docs) return [];
  return docs.map((m) => ({
    year: m.year,
    action: m.action,
    emissionsSaved: m.emissionsSaved,
    cost: m.cost ?? 0,
    status: m.status,
    scope: m.scope ?? "cross",
    cumulativeEmissionsSaved: m.cumulativeEmissionsSaved ?? 0,
    pathwayEmissions: m.pathwayEmissions ?? 0,
  }));
}

export function planToPayloadData(
  plan: PathwayPlanResult,
  extras?: { description?: string | null; status?: "draft" | "in_progress" },
) {
  return {
    name: plan.name,
    description: extras?.description ?? undefined,
    baselineYear: plan.baselineYear,
    targetYear: plan.targetYear,
    baselineEmissions: plan.baselineEmissions,
    targetEmissions: plan.targetEmissions,
    targetReduction: plan.targetReduction,
    milestones: milestonesFromPlan(plan),
    feasibility: {
      level: plan.feasibility.level,
      requiredAnnualReduction: plan.feasibility.requiredAnnualReduction,
      requiredAnnualReductionPercent: plan.feasibility.requiredAnnualReductionPercent,
      peerTypicalAnnualPercent: plan.feasibility.peerTypicalAnnualPercent,
      warning: plan.feasibility.warning,
      message: plan.feasibility.message,
    },
    costEstimate: plan.costEstimate,
    timeline: plan.timeline.map((p) => ({
      year: p.year,
      baselineHold: p.baselineHold,
      pathwayEmissions: p.pathwayEmissions,
      isMilestone: p.isMilestone,
    })),
    stages: plan.milestones.map((m, index, arr) => {
      const cumulativeCapex = arr
        .slice(0, index + 1)
        .reduce((sum, row) => sum + row.cost, 0);
      return {
        year: m.year,
        targetEmissions: m.pathwayEmissions,
        leversApplied: [
          {
            leverId: `${m.scope}-${m.year}-${index}`,
            leverName: m.action,
            emissionReduction: m.emissionsSaved,
            capexRequired: m.cost,
          },
        ],
        cumulativeCapex,
      };
    }),
    scienceBasedTargetAlignment: plan.scienceBasedTargetAlignment,
    status: extras?.status ?? "draft",
  };
}

export function parseInterventionsBody(raw: unknown): InterventionTemplate[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: InterventionTemplate[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id =
      typeof r.id === "string" ? r.id : typeof r.action === "string" ? r.action : null;
    const action = typeof r.action === "string" ? r.action : null;
    const emissionsSaved = Number(r.emissionsSaved);
    const cost = Number(r.cost ?? 0);
    const scope = parsePathwayScope(r.scope) ?? "cross";
    if (!id || !action || !Number.isFinite(emissionsSaved) || emissionsSaved < 0)
      continue;
    out.push({
      id,
      action,
      scope,
      emissionsSaved,
      cost: Number.isFinite(cost) ? cost : 0,
    });
  }
  return out.length > 0 ? out : undefined;
}

export async function loadActualEmissions(
  payload: Payload,
  organisationId: string,
  year: number,
): Promise<{
  emissions: number;
  quality: "calculated" | "missing";
  message: string | null;
}> {
  const resolved = await resolveOrgBaselineByScope(payload, organisationId, year);
  const total =
    resolved.baseline.scope1 + resolved.baseline.scope2 + resolved.baseline.scope3;
  if (resolved.quality === "calculated" && total >= 0) {
    return { emissions: total, quality: "calculated", message: null };
  }
  return {
    emissions: 0,
    quality: "missing",
    message: resolved.message ?? `No calculated emissions for ${year}`,
  };
}

export async function buildPathwayProgress(args: {
  payload: Payload;
  organisationId: string;
  pathway: {
    baselineEmissions: number;
    targetEmissions: number;
    baselineYear: number;
    targetYear: number;
    milestones?: PathwayDocMilestone[] | null;
    timeline?: PathwayTimelinePoint[] | null;
    feasibility?: Partial<FeasibilityResult> | null;
  };
  asOfYear?: number;
}): Promise<{
  comparison: ActualProgressComparison | null;
  asOfYear: number;
  actualQuality: "calculated" | "missing";
  actualMessage: string | null;
  timeline: PathwayTimelinePoint[];
}> {
  const asOfYear = args.asOfYear ?? new Date().getFullYear();
  const milestones = docMilestonesToPure(args.pathway.milestones);
  const timeline =
    args.pathway.timeline && args.pathway.timeline.length > 0
      ? args.pathway.timeline
      : buildTimeline({
          baselineEmissions: args.pathway.baselineEmissions,
          baselineYear: args.pathway.baselineYear,
          targetYear: args.pathway.targetYear,
          milestones,
        });

  const actual = await loadActualEmissions(args.payload, args.organisationId, asOfYear);

  if (actual.quality === "missing") {
    return {
      comparison: null,
      asOfYear,
      actualQuality: "missing",
      actualMessage: actual.message,
      timeline,
    };
  }

  const comparison = compareActualToPathway({
    baselineEmissions: args.pathway.baselineEmissions,
    targetEmissions: args.pathway.targetEmissions,
    baselineYear: args.pathway.baselineYear,
    targetYear: args.pathway.targetYear,
    asOfYear,
    actualEmissions: actual.emissions,
    milestones,
  });

  return {
    comparison,
    asOfYear,
    actualQuality: "calculated",
    actualMessage: null,
    timeline,
  };
}

export function normalizeMilestoneUpdates(
  raw: unknown,
  baselineEmissions: number,
): { milestones: PathwayDocMilestone[]; error: string | null } {
  if (!Array.isArray(raw)) {
    return { milestones: [], error: "milestones must be an array" };
  }

  const milestones: PathwayDocMilestone[] = [];
  let cumulative = 0;
  let emissions = baselineEmissions;

  for (const row of raw) {
    if (!row || typeof row !== "object") {
      return { milestones: [], error: "Each milestone must be an object" };
    }
    const r = row as Record<string, unknown>;
    const year = Number(r.year);
    const action = typeof r.action === "string" ? r.action.trim() : "";
    const emissionsSaved = Number(r.emissionsSaved);
    const cost = Number(r.cost ?? 0);
    const status = parseMilestoneStatus(r.status) ?? "planned";
    const scope = parsePathwayScope(r.scope) ?? "cross";

    if (!Number.isInteger(year)) {
      return { milestones: [], error: "milestone.year must be an integer" };
    }
    if (!action) {
      return { milestones: [], error: "milestone.action is required" };
    }
    if (!Number.isFinite(emissionsSaved) || emissionsSaved < 0) {
      return { milestones: [], error: "milestone.emissionsSaved must be ≥ 0" };
    }

    cumulative += emissionsSaved;
    emissions = Math.max(0, emissions - emissionsSaved);

    milestones.push({
      year,
      action,
      emissionsSaved,
      cost: Number.isFinite(cost) ? cost : 0,
      status,
      scope,
      cumulativeEmissionsSaved: cumulative,
      pathwayEmissions: emissions,
    });
  }

  milestones.sort((a, b) => a.year - b.year);
  return { milestones, error: null };
}

export { calculatePathway };
