/**
 * Decarbon plan closed loop — read-only assembly of a target cascade's linked
 * abatement levers (MACC) and reduction projects into one plan summary.
 *
 * This module performs no I/O itself: callers (API routes) load the cascade, its
 * progress roll-up, and the linked lever/project DTOs, then pass them in here.
 * Missing measured data on any leg (progress, levers, projects) is surfaced as
 * "missing"/"partial" quality — never coerced to zero or silently dropped.
 */

import type { AbatementLeverDto } from "./maccService";
import { computeOrgMacc } from "./maccService";
import type { MaccQuality } from "./maccTypes";
import type { ReductionProjectDto } from "./reductionService";
import { buildReductionSummary } from "./reductionService";
import type { ReductionAggregateQuality } from "./reductionTypes";
import type { CascadeProgressRollup, CascadeStatus } from "./targetCascade";
import type { CascadedTargetDto } from "./targetCascadeService";

export type DecarbonPlanQuality = "measured" | "partial" | "missing";

export type DecarbonPlanLevers = {
  linkedCount: number;
  totalAnnualAbatementTco2e: number | null;
  totalAnnualisedCost: number | null;
  weightedAverageCostPerTco2e: number | null;
  measuredCount: number;
  missingCount: number;
  quality: MaccQuality;
  message: string | null;
};

export type DecarbonPlanProjects = {
  linkedCount: number;
  plannedTotalTco2e: number;
  actualTotalTco2e: number | null;
  projectsWithActual: number;
  projectsMissingActual: number;
  quality: ReductionAggregateQuality;
  message: string | null;
};

export type DecarbonPlan = {
  cascadeId: string;
  cascadeName: string;
  status: CascadeStatus;
  progress: CascadeProgressRollup;
  levers: DecarbonPlanLevers;
  projects: DecarbonPlanProjects;
  /** Worst-case quality across progress roll-up, MACC, and reduction summary. */
  quality: DecarbonPlanQuality;
  message: string | null;
};

/**
 * Assemble the decarbon plan for one cascade from its progress roll-up and the
 * abatement levers / reduction projects already linked via `CascadedTargets`
 * relationships.
 */
export function getDecarbonPlan(input: {
  cascade: Pick<CascadedTargetDto, "id" | "name" | "status">;
  progress: CascadeProgressRollup;
  linkedLevers: AbatementLeverDto[];
  linkedProjects: ReductionProjectDto[];
}): DecarbonPlan {
  const macc = computeOrgMacc(input.linkedLevers);
  const reduction = buildReductionSummary(input.linkedProjects);

  const levers: DecarbonPlanLevers = {
    linkedCount: input.linkedLevers.length,
    totalAnnualAbatementTco2e: macc.totalAnnualAbatementTco2e,
    totalAnnualisedCost: macc.totalAnnualisedCost,
    weightedAverageCostPerTco2e: macc.weightedAverageCostPerTco2e,
    measuredCount: macc.measuredCount,
    missingCount: macc.missingCount,
    quality: macc.quality,
    message: macc.message,
  };

  const projects: DecarbonPlanProjects = {
    linkedCount: input.linkedProjects.length,
    plannedTotalTco2e: reduction.plannedTotalTco2e,
    actualTotalTco2e: reduction.actualTotalTco2e,
    projectsWithActual: reduction.projectsWithActual,
    projectsMissingActual: reduction.projectsMissingActual,
    quality: reduction.quality,
    message: reduction.message,
  };

  const hasLevers = input.linkedLevers.length > 0;
  const hasProjects = input.linkedProjects.length > 0;

  let quality: DecarbonPlanQuality;
  let message: string | null = null;

  if (!hasLevers && !hasProjects) {
    quality = "missing";
    message =
      "No abatement levers or reduction projects are linked to this cascade yet. Link them from the MACC and reduction-project collections to close the loop.";
  } else {
    const legQualities: DecarbonPlanQuality[] = [
      input.progress.quality,
      hasLevers ? levers.quality : "measured",
      hasProjects ? projects.quality : "measured",
    ];
    if (legQualities.every((q) => q === "measured")) {
      quality = "measured";
    } else if (legQualities.every((q) => q === "missing")) {
      quality = "missing";
      message =
        "Cascade progress and the linked plan are both missing measured data — never treated as zero.";
    } else {
      quality = "partial";
      message =
        "Some of cascade progress, linked levers, or linked projects are missing measured data.";
    }
  }

  return {
    cascadeId: input.cascade.id,
    cascadeName: input.cascade.name,
    status: input.cascade.status,
    progress: input.progress,
    levers,
    projects,
    quality,
    message,
  };
}
