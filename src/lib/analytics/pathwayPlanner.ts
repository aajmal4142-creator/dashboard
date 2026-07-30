/**
 * Decarbonization pathway planning and SBTi alignment
 */

export interface PathwayStage {
  year: number;
  targetEmissions: number;
  leversApplied: {
    leverId: string;
    leverName: string;
    emissionReduction: number;
    capexRequired: number;
  }[];
  cumulativeCapex: number;
}

export interface DecarbonizationPathway {
  name: string;
  baselineYear: number;
  targetYear: number;
  baselineEmissions: number;
  targetEmissions: number;
  targetReduction: number; // percentage
  stages: PathwayStage[];
  scienceBasedTargetAlignment: {
    warming1_5C: boolean;
    warming2_0C: boolean;
    alignedWith: string;
  };
  costBenefitAnalysis: {
    totalCapex: number;
    totalSavings: number;
    roi: number;
    paybackPeriod: number;
  };
}

const SBTi_TARGETS = {
  warming1_5C: {
    annual_reduction: 0.07, // 7% annual reduction needed
    total_reduction_by_2030: 0.43, // 43% by 2030
    total_reduction_by_2050: 0.95, // 95% by 2050 (net zero)
  },
  warming2_0C: {
    annual_reduction: 0.042, // 4.2% annual reduction
    total_reduction_by_2030: 0.25, // 25% by 2030
    total_reduction_by_2050: 0.9, // 90% by 2050
  },
};

/**
 * Check if a pathway aligns with SBTi targets
 */
export function checkSBTiAlignment(
  baselineEmissions: number,
  targetEmissions: number,
  baselineYear: number,
  targetYear: number,
): DecarbonizationPathway["scienceBasedTargetAlignment"] {
  const yearsToTarget = targetYear - baselineYear;

  // Calculate required compound annual reduction rate
  const requiredAnnualReduction =
    1 - (targetEmissions / baselineEmissions) ** (1 / yearsToTarget);

  const alignment1_5C =
    requiredAnnualReduction >= SBTi_TARGETS.warming1_5C.annual_reduction;
  const alignment2_0C =
    requiredAnnualReduction >= SBTi_TARGETS.warming2_0C.annual_reduction;

  return {
    warming1_5C: alignment1_5C,
    warming2_0C: alignment2_0C,
    alignedWith: alignment1_5C
      ? "1.5°C pathway"
      : alignment2_0C
        ? "2.0°C pathway"
        : "No alignment",
  };
}

/**
 * Generate optimized decarbonization pathway
 */
export function generateOptimizedPathway(
  baselineEmissions: number,
  targetEmissions: number,
  baselineYear: number,
  targetYear: number,
  availableLevers: {
    id: string;
    name: string;
    maxReductionPercentage: number;
    priority: number;
  }[],
): DecarbonizationPathway {
  const yearsToTarget = targetYear - baselineYear;
  const totalReduction = baselineEmissions - targetEmissions;
  const stages: PathwayStage[] = [];

  // Sort levers by priority
  const sortedLevers = [...availableLevers].sort((a, b) => a.priority - b.priority);

  let currentEmissions = baselineEmissions;
  let cumulativeCapex = 0;
  let cumulativeSavings = 0;

  // Distribute reduction across years
  for (let year = baselineYear + 1; year <= targetYear; year++) {
    const proportionalReduction = totalReduction / yearsToTarget;

    currentEmissions = Math.max(
      targetEmissions,
      currentEmissions - proportionalReduction,
    );

    const leversApplied: PathwayStage["leversApplied"] = [];
    let yearCapex = 0;
    let yearSavings = 0;

    // Apply levers to achieve proportional reduction
    for (const lever of sortedLevers) {
      const maxReduction = (lever.maxReductionPercentage / 100) * proportionalReduction;
      const leverCapex = maxReduction * 0.1; // Simplified: $100k per tCO2e
      const leverSavings = maxReduction * 0.05; // Simplified: $50k per tCO2e saved

      leversApplied.push({
        leverId: lever.id,
        leverName: lever.name,
        emissionReduction: maxReduction,
        capexRequired: leverCapex,
      });

      yearCapex += leverCapex;
      yearSavings += leverSavings;
    }

    cumulativeCapex += yearCapex;
    cumulativeSavings += yearSavings;

    stages.push({
      year,
      targetEmissions: currentEmissions,
      leversApplied,
      cumulativeCapex,
    });
  }

  const reductionPercentage =
    ((baselineEmissions - targetEmissions) / baselineEmissions) * 100;
  const alignment = checkSBTiAlignment(
    baselineEmissions,
    targetEmissions,
    baselineYear,
    targetYear,
  );

  return {
    name: `Decarbonization Pathway to ${reductionPercentage.toFixed(0)}% reduction by ${targetYear}`,
    baselineYear,
    targetYear,
    baselineEmissions,
    targetEmissions,
    targetReduction: reductionPercentage,
    stages,
    scienceBasedTargetAlignment: alignment,
    costBenefitAnalysis: {
      totalCapex: cumulativeCapex,
      totalSavings: cumulativeSavings,
      roi: ((cumulativeSavings - cumulativeCapex) / cumulativeCapex) * 100,
      paybackPeriod: cumulativeCapex / Math.max(cumulativeSavings / yearsToTarget, 1),
    },
  };
}

/**
 * Milestone-based pathway (year-on-year targets with approval gates)
 */
export interface MilestonePathway extends DecarbonizationPathway {
  milestones: {
    year: number;
    targetEmissions: number;
    approvalRequired: boolean;
    approvedAt?: Date;
    approvedBy?: string;
  }[];
}

export function generateMilestonePathway(
  baselineEmissions: number,
  targetEmissions: number,
  baselineYear: number,
  targetYear: number,
  _milestonesTonsPerYear?: number[],
): MilestonePathway {
  const pathway = generateOptimizedPathway(
    baselineEmissions,
    targetEmissions,
    baselineYear,
    targetYear,
    [
      {
        id: "renewable",
        name: "Renewable Energy Transition",
        maxReductionPercentage: 25,
        priority: 1,
      },
      {
        id: "efficiency",
        name: "Energy Efficiency",
        maxReductionPercentage: 15,
        priority: 2,
      },
      {
        id: "fuel_switching",
        name: "Fleet Electrification",
        maxReductionPercentage: 12,
        priority: 3,
      },
      {
        id: "behavior",
        name: "Behavior Change Programs",
        maxReductionPercentage: 8,
        priority: 4,
      },
    ],
  );

  const yearsToTarget = targetYear - baselineYear;
  const targetReductionPerYear = (baselineEmissions - targetEmissions) / yearsToTarget;

  const milestones = [];
  for (let year = baselineYear + 1; year <= targetYear; year++) {
    const yearIndex = year - baselineYear;
    const targetEmissionsThisYear =
      baselineEmissions - targetReductionPerYear * yearIndex;

    milestones.push({
      year,
      targetEmissions: targetEmissionsThisYear,
      approvalRequired: year % 3 === 0, // Every 3 years
    });
  }

  return {
    ...pathway,
    milestones,
  };
}

/**
 * Compare pathways side-by-side
 */
export interface PathwayComparison {
  pathways: DecarbonizationPathway[];
  recommendedPathway: string; // pathway name
  rationale: string;
}

export function comparePathways(pathways: DecarbonizationPathway[]): PathwayComparison {
  if (pathways.length === 0) {
    return {
      pathways: [],
      recommendedPathway: "No pathways",
      rationale: "No pathways provided",
    };
  }

  // Score pathways based on cost-effectiveness and SBTi alignment
  const scoredPathways = pathways.map((p) => ({
    pathway: p,
    score:
      (p.scienceBasedTargetAlignment.warming1_5C ? 50 : 25) +
      (p.costBenefitAnalysis.roi / 100) * 50,
  }));

  const best = scoredPathways.reduce((prev, current) =>
    current.score > prev.score ? current : prev,
  );

  const rationale = `Pathway "${best.pathway.name}" recommended based on ${best.pathway.scienceBasedTargetAlignment.warming1_5C ? "1.5°C SBTi alignment" : "2.0°C SBTi alignment"} and ${best.pathway.costBenefitAnalysis.roi.toFixed(0)}% ROI.`;

  return {
    pathways,
    recommendedPathway: best.pathway.name,
    rationale,
  };
}
