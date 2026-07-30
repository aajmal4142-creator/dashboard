import type { DataGap } from "./types";

export type ESGFramework = "csrd" | "brsr" | "gri" | "sasb";

interface RequiredMetric {
  metricKey: string;
  label: string;
  scope: "scope1" | "scope2" | "scope3" | "all";
  severity: "high" | "medium" | "low";
}

// Framework requirement definitions - which metrics are required for each framework
const FRAMEWORK_REQUIREMENTS: Record<ESGFramework, RequiredMetric[]> = {
  csrd: [
    {
      metricKey: "csrd_scope1",
      label: "Scope 1 Emissions",
      scope: "scope1",
      severity: "high",
    },
    {
      metricKey: "csrd_scope2",
      label: "Scope 2 Emissions",
      scope: "scope2",
      severity: "high",
    },
    {
      metricKey: "csrd_scope3",
      label: "Scope 3 Emissions",
      scope: "scope3",
      severity: "high",
    },
    {
      metricKey: "csrd_scope1_intensity",
      label: "Scope 1 Intensity",
      scope: "scope1",
      severity: "medium",
    },
    {
      metricKey: "csrd_ghg_intensity",
      label: "GHG Intensity (per revenue)",
      scope: "all",
      severity: "high",
    },
    {
      metricKey: "csrd_biogenic_co2",
      label: "Biogenic CO2",
      scope: "all",
      severity: "low",
    },
  ],
  brsr: [
    {
      metricKey: "brsr_total_emissions",
      label: "Total GHG Emissions",
      scope: "all",
      severity: "high",
    },
    {
      metricKey: "brsr_scope1",
      label: "Scope 1 Emissions",
      scope: "scope1",
      severity: "high",
    },
    {
      metricKey: "brsr_scope2",
      label: "Scope 2 Emissions",
      scope: "scope2",
      severity: "high",
    },
    {
      metricKey: "brsr_scope3",
      label: "Scope 3 Emissions",
      scope: "scope3",
      severity: "high",
    },
    {
      metricKey: "brsr_emissions_intensity",
      label: "Emissions Intensity per Revenue",
      scope: "all",
      severity: "medium",
    },
    {
      metricKey: "brsr_energy_consumption",
      label: "Energy Consumption",
      scope: "all",
      severity: "medium",
    },
    {
      metricKey: "brsr_renewable_energy_pct",
      label: "Renewable Energy Percentage",
      scope: "all",
      severity: "medium",
    },
  ],
  gri: [
    {
      metricKey: "gri_scope1",
      label: "Scope 1 Emissions",
      scope: "scope1",
      severity: "high",
    },
    {
      metricKey: "gri_scope2",
      label: "Scope 2 Emissions",
      scope: "scope2",
      severity: "high",
    },
    {
      metricKey: "gri_scope3",
      label: "Scope 3 Emissions",
      scope: "scope3",
      severity: "high",
    },
    {
      metricKey: "gri_emissions_intensity",
      label: "Emissions Intensity",
      scope: "all",
      severity: "medium",
    },
    {
      metricKey: "gri_biogenic_emissions",
      label: "Biogenic Emissions",
      scope: "all",
      severity: "low",
    },
    {
      metricKey: "gri_yoy_comparison",
      label: "Year-over-Year Comparison",
      scope: "all",
      severity: "low",
    },
  ],
  sasb: [
    {
      metricKey: "sasb_scope1",
      label: "Scope 1 Emissions",
      scope: "scope1",
      severity: "high",
    },
    {
      metricKey: "sasb_scope2",
      label: "Scope 2 Emissions",
      scope: "scope2",
      severity: "high",
    },
    {
      metricKey: "sasb_scope3",
      label: "Scope 3 Emissions",
      scope: "scope3",
      severity: "high",
    },
    {
      metricKey: "sasb_absolute_emissions",
      label: "Absolute Emissions",
      scope: "all",
      severity: "high",
    },
    {
      metricKey: "sasb_emissions_intensity",
      label: "Emissions Intensity",
      scope: "all",
      severity: "medium",
    },
  ],
};

export interface EmissionsData {
  scope1?: number;
  scope2?: number;
  scope3?: number;
  total?: number;
  revenue?: number;
  units?: number;
}

export class DataGapDetector {
  /**
   * Detect data gaps for a given framework and scope
   */
  async detectGaps(
    framework: ESGFramework,
    emissionsData: EmissionsData,
    scope: "scope1" | "scope2" | "scope3" | "all" = "all",
  ): Promise<DataGap[]> {
    const gaps: DataGap[] = [];
    const requirements = FRAMEWORK_REQUIREMENTS[framework] || [];

    for (const requirement of requirements) {
      // Skip if requirement doesn't match requested scope
      if (scope !== "all" && requirement.scope !== "all" && requirement.scope !== scope) {
        continue;
      }

      const isMissing = this.isMetricMissing(requirement, emissionsData, false);

      if (isMissing) {
        gaps.push({
          metric: requirement.metricKey,
          severity: requirement.severity,
          description: `Missing required metric: ${requirement.label}`,
          framework,
          affectedScope:
            scope !== "all" ? (scope as "scope1" | "scope2" | "scope3") : undefined,
        });
      }
    }

    return gaps;
  }

  /**
   * Check if a specific metric is missing
   */
  private isMetricMissing(
    requirement: RequiredMetric,
    emissionsData: EmissionsData,
    forCoverage = true,
  ): boolean {
    // Check scope-specific metrics
    if (requirement.scope === "scope1" && emissionsData.scope1 === undefined) return true;
    if (requirement.scope === "scope2" && emissionsData.scope2 === undefined) return true;
    if (requirement.scope === "scope3" && emissionsData.scope3 === undefined) return true;

    // Check compound metrics
    if (requirement.metricKey.includes("intensity")) {
      const hasEmissions =
        emissionsData.scope1 !== undefined ||
        emissionsData.scope2 !== undefined ||
        emissionsData.scope3 !== undefined;
      const hasDenominator =
        emissionsData.revenue !== undefined || emissionsData.units !== undefined;
      return !hasEmissions || !hasDenominator;
    }

    // Check total emissions
    if (requirement.metricKey.includes("total")) {
      return emissionsData.total === undefined;
    }

    // Check framework-specific metrics that require special data
    // These are always considered "missing" if not explicitly provided
    // (For now, we assume these come from separate data sources, not direct emissions data)
    const isFrameworkSpecific =
      requirement.metricKey.includes("renewable") ||
      requirement.metricKey.includes("yoy_comparison") ||
      requirement.metricKey.includes("biogenic") ||
      requirement.metricKey.includes("absolute");

    if (isFrameworkSpecific) {
      // For coverage calculation, exclude low-priority framework-specific metrics
      if (forCoverage && requirement.severity === "low") {
        return false; // Don't count low-priority missing metrics in coverage
      }
      return true; // These require specific data not in EmissionsData
    }

    return false;
  }

  /**
   * Score gap severity in context
   */
  scoreGapSeverity(
    gap: DataGap,
    criticalityFactor: number = 1,
  ): "high" | "medium" | "low" {
    // Base severity
    let score = 0;
    if (gap.severity === "high") score = 10;
    else if (gap.severity === "medium") score = 5;
    else score = 1;

    // Apply criticality factor
    score *= criticalityFactor;

    if (score >= 9) return "high";
    if (score >= 3) return "medium";
    return "low";
  }

  /**
   * Get all required metrics for a framework
   */
  getFrameworkRequirements(
    framework: ESGFramework,
    scope: "scope1" | "scope2" | "scope3" | "all" = "all",
  ): RequiredMetric[] {
    const requirements = FRAMEWORK_REQUIREMENTS[framework] || [];

    if (scope === "all") {
      return requirements;
    }

    return requirements.filter((r) => r.scope === "all" || r.scope === scope);
  }

  /**
   * Calculate coverage percentage
   */
  calculateCoverage(
    framework: ESGFramework,
    emissionsData: EmissionsData,
    scope: "scope1" | "scope2" | "scope3" | "all" = "all",
  ): number {
    const requirements = this.getFrameworkRequirements(framework, scope);
    if (requirements.length === 0) return 100;

    const covered = requirements.filter(
      (r) => !this.isMetricMissing(r, emissionsData, true),
    ).length;

    return (covered / requirements.length) * 100;
  }

  /**
   * Map gaps to framework metrics
   */
  mapGapsToMetrics(gaps: DataGap[]): Map<string, DataGap[]> {
    const map = new Map<string, DataGap[]>();

    for (const gap of gaps) {
      const framework = gap.framework || "unknown";
      if (!map.has(framework)) {
        map.set(framework, []);
      }
      map.get(framework)!.push(gap);
    }

    return map;
  }

  /**
   * Get high-severity gaps
   */
  criticalGaps(gaps: DataGap[]): DataGap[] {
    return gaps.filter((g) => g.severity === "high");
  }
}
