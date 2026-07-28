import type {
  ESGFramework,
  FrameworkMetric,
  FrameworkMetricValue,
  TrajectoryAnalysis,
  ComplianceScore,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Built-in Framework Metric Definitions
// ─────────────────────────────────────────────────────────────────────

const FRAMEWORK_METRICS: Record<ESGFramework, FrameworkMetric[]> = {
  csrd: [
    {
      id: "csrd_scope1",
      framework: "csrd",
      metricKey: "csrd_scope1",
      label: "Scope 1 Emissions",
      unit: "tCO2e",
      description: "Direct emissions from owned or controlled sources",
      dataType: "emissions",
      required: true,
    },
    {
      id: "csrd_scope2",
      framework: "csrd",
      metricKey: "csrd_scope2",
      label: "Scope 2 Emissions (Market-based)",
      unit: "tCO2e",
      description: "Indirect emissions from purchased electricity, steam, and heat",
      dataType: "emissions",
      required: true,
    },
    {
      id: "csrd_scope3",
      framework: "csrd",
      metricKey: "csrd_scope3",
      label: "Scope 3 Emissions",
      unit: "tCO2e",
      description: "All other indirect emissions in the value chain",
      dataType: "emissions",
      required: true,
    },
    {
      id: "csrd_intensity",
      framework: "csrd",
      metricKey: "csrd_intensity",
      label: "GHG Intensity per Revenue",
      unit: "tCO2e/€M",
      description: "Total emissions divided by revenue in millions of euros",
      dataType: "intensity",
      required: true,
    },
    {
      id: "csrd_biogenic",
      framework: "csrd",
      metricKey: "csrd_biogenic",
      label: "Biogenic CO2 Emissions",
      unit: "tCO2e",
      description: "CO2 from biomass burning and decomposition",
      dataType: "emissions",
      required: false,
    },
    {
      id: "csrd_removals",
      framework: "csrd",
      metricKey: "csrd_removals",
      label: "Carbon Removals",
      unit: "tCO2e",
      description: "CO2 removal from carbon capture and storage",
      dataType: "emissions",
      required: false,
    },
  ],
  brsr: [
    {
      id: "brsr_scope1",
      framework: "brsr",
      metricKey: "brsr_scope1",
      label: "Scope 1 Emissions",
      unit: "tCO2e",
      description: "Direct GHG emissions from owned or controlled sources",
      dataType: "emissions",
      required: true,
    },
    {
      id: "brsr_scope2",
      framework: "brsr",
      metricKey: "brsr_scope2",
      label: "Scope 2 Emissions",
      unit: "tCO2e",
      description: "Indirect emissions from purchased electricity",
      dataType: "emissions",
      required: true,
    },
    {
      id: "brsr_scope3",
      framework: "brsr",
      metricKey: "brsr_scope3",
      label: "Scope 3 Emissions",
      unit: "tCO2e",
      description: "Other indirect emissions in the value chain",
      dataType: "emissions",
      required: true,
    },
    {
      id: "brsr_intensity",
      framework: "brsr",
      metricKey: "brsr_intensity",
      label: "Emissions Intensity per Revenue",
      unit: "tCO2e/INR Cr",
      description: "Total emissions divided by revenue in crores",
      dataType: "intensity",
      required: true,
    },
    {
      id: "brsr_energy",
      framework: "brsr",
      metricKey: "brsr_energy",
      label: "Total Energy Consumption",
      unit: "MWh",
      description: "Total energy used (renewable + non-renewable)",
      dataType: "custom",
      required: false,
    },
    {
      id: "brsr_renewable",
      framework: "brsr",
      metricKey: "brsr_renewable",
      label: "Renewable Energy Percentage",
      unit: "%",
      description: "Percentage of energy from renewable sources",
      dataType: "percentage",
      required: false,
    },
  ],
  gri: [
    {
      id: "gri_scope1",
      framework: "gri",
      metricKey: "gri_scope1",
      label: "Direct GHG Emissions (Scope 1)",
      unit: "tCO2e",
      description: "GHG emissions from sources owned or controlled by the organization",
      dataType: "emissions",
      required: true,
    },
    {
      id: "gri_scope2",
      framework: "gri",
      metricKey: "gri_scope2",
      label: "Energy Indirect GHG Emissions (Scope 2)",
      unit: "tCO2e",
      description: "GHG emissions from purchased electricity, steam, and heating",
      dataType: "emissions",
      required: true,
    },
    {
      id: "gri_scope3",
      framework: "gri",
      metricKey: "gri_scope3",
      label: "Other Indirect GHG Emissions (Scope 3)",
      unit: "tCO2e",
      description: "All other indirect GHG emissions in the value chain",
      dataType: "emissions",
      required: true,
    },
    {
      id: "gri_biogenic",
      framework: "gri",
      metricKey: "gri_biogenic",
      label: "Biogenic Emissions",
      unit: "tCO2e",
      description: "CO2 emissions from biomass-based energy",
      dataType: "emissions",
      required: false,
    },
    {
      id: "gri_yoy_change",
      framework: "gri",
      metricKey: "gri_yoy_change",
      label: "Year-over-Year Emissions Change",
      unit: "%",
      description: "Percentage change in total emissions vs prior year",
      dataType: "percentage",
      required: false,
    },
  ],
  sasb: [
    {
      id: "sasb_scope1",
      framework: "sasb",
      metricKey: "sasb_scope1",
      label: "Scope 1 Emissions by Operation",
      unit: "tCO2e",
      description: "Direct emissions by operational category",
      dataType: "emissions",
      required: true,
    },
    {
      id: "sasb_scope2",
      framework: "sasb",
      metricKey: "sasb_scope2",
      label: "Scope 2 Emissions by Operation",
      unit: "tCO2e",
      description: "Indirect emissions by operational category",
      dataType: "emissions",
      required: true,
    },
    {
      id: "sasb_scope3",
      framework: "sasb",
      metricKey: "sasb_scope3",
      label: "Scope 3 Emissions by Operation",
      unit: "tCO2e",
      description: "Value chain emissions by operational category",
      dataType: "emissions",
      required: false,
    },
    {
      id: "sasb_intensity",
      framework: "sasb",
      metricKey: "sasb_intensity",
      label: "Emissions Intensity (Absolute + Normalized)",
      unit: "tCO2e/unit",
      description: "Absolute emissions and normalized by production/revenue",
      dataType: "intensity",
      required: true,
    },
    {
      id: "sasb_risk_materiality",
      framework: "sasb",
      metricKey: "sasb_risk_materiality",
      label: "Climate Risk & Materiality Score",
      unit: "score",
      description: "Assessment of material climate-related risks",
      dataType: "custom",
      required: false,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Framework Mapping Engine
// ─────────────────────────────────────────────────────────────────────

export class FrameworkMappingEngine {
  getFrameworkMetrics(framework: ESGFramework): FrameworkMetric[] {
    return FRAMEWORK_METRICS[framework] || [];
  }

  async mapEmissionsToFramework(
    emissions: { scope1: number; scope2: number; scope3: number; total: number },
    framework: ESGFramework,
    metadata?: { revenue?: number; employees?: number; units?: number },
  ): Promise<FrameworkMetricValue[]> {
    const metrics: FrameworkMetricValue[] = [];
    const now = new Date();

    switch (framework) {
      case "csrd":
        metrics.push({
          metricKey: "csrd_scope1",
          value: emissions.scope1,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope1),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "csrd_scope2",
          value: emissions.scope2,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope2),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "csrd_scope3",
          value: emissions.scope3,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope3),
          calculatedAt: now,
        });

        if (metadata?.revenue) {
          const intensity = emissions.total / (metadata.revenue / 1_000_000); // revenue in millions
          metrics.push({
            metricKey: "csrd_intensity",
            value: intensity,
            unit: "tCO2e/€M",
            confidence: "high",
            calculatedAt: now,
          });
        }
        break;

      case "brsr":
        metrics.push({
          metricKey: "brsr_scope1",
          value: emissions.scope1,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope1),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "brsr_scope2",
          value: emissions.scope2,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope2),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "brsr_scope3",
          value: emissions.scope3,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope3),
          calculatedAt: now,
        });

        if (metadata?.revenue) {
          const intensity = emissions.total / (metadata.revenue / 10_000_000); // revenue in crores
          metrics.push({
            metricKey: "brsr_intensity",
            value: intensity,
            unit: "tCO2e/INR Cr",
            confidence: "high",
            calculatedAt: now,
          });
        }
        break;

      case "gri":
        metrics.push({
          metricKey: "gri_scope1",
          value: emissions.scope1,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope1),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "gri_scope2",
          value: emissions.scope2,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope2),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "gri_scope3",
          value: emissions.scope3,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope3),
          calculatedAt: now,
        });
        break;

      case "sasb":
        metrics.push({
          metricKey: "sasb_scope1",
          value: emissions.scope1,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope1),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "sasb_scope2",
          value: emissions.scope2,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope2),
          calculatedAt: now,
        });
        metrics.push({
          metricKey: "sasb_scope3",
          value: emissions.scope3,
          unit: "tCO2e",
          confidence: this.getConfidence(emissions.scope3),
          calculatedAt: now,
        });

        if (metadata?.revenue && metadata.units) {
          const intensity = emissions.total / metadata.units;
          metrics.push({
            metricKey: "sasb_intensity",
            value: intensity,
            unit: "tCO2e/unit",
            confidence: "high",
            calculatedAt: now,
          });
        }
        break;
    }

    return metrics;
  }

  async getFrameworkKPIs(
    framework: ESGFramework,
    emissions: { scope1: number; scope2: number; scope3: number; total: number },
    metadata?: { revenue?: number; employees?: number; units?: number },
  ): Promise<FrameworkMetricValue[]> {
    return this.mapEmissionsToFramework(emissions, framework, metadata);
  }

  async checkCompliance(
    framework: ESGFramework,
    metrics: FrameworkMetricValue[],
  ): Promise<ComplianceScore> {
    const frameworkMetrics = this.getFrameworkMetrics(framework);
    const requiredMetrics = frameworkMetrics.filter((m) => m.required);
    const providedKeys = new Set(metrics.map((m) => m.metricKey));

    const metricsProvided = requiredMetrics.filter((m) =>
      providedKeys.has(m.metricKey),
    ).length;
    const metricsRequired = requiredMetrics.length;

    const score = Math.round((metricsProvided / metricsRequired) * 100);

    return {
      framework,
      score,
      metricsProvided,
      metricsRequired,
      status: score === 100 ? "compliant" : score >= 75 ? "partial" : "non-compliant",
    };
  }

  async calculateTrajectory(
    framework: ESGFramework,
    currentValue: number,
    targetValue: number,
    targetYear: number,
    historicalValues: Array<{ year: number; value: number }>,
  ): Promise<TrajectoryAnalysis> {
    const currentYear = new Date().getFullYear();
    const yearsRemaining = Math.max(1, targetYear - currentYear);

    // Simple linear regression on last 3-5 years
    const recentHistory = historicalValues.slice(-5);
    let trend = 0;

    if (recentHistory.length > 1) {
      const firstYear = recentHistory[0].year;
      const lastYear = recentHistory[recentHistory.length - 1].year;
      const firstValue = recentHistory[0].value;
      const lastValue = recentHistory[recentHistory.length - 1].value;
      const yearsDiff = lastYear - firstYear;

      if (yearsDiff > 0) {
        trend = (lastValue - firstValue) / yearsDiff;
      }
    }

    const projectedValue = currentValue + trend * yearsRemaining;
    const trendPercentChange = currentValue !== 0 ? (trend / currentValue) * 100 : 0;
    const onTrack =
      (targetValue < currentValue && projectedValue <= targetValue) ||
      (targetValue > currentValue && projectedValue >= targetValue) ||
      targetValue === currentValue;

    return {
      framework,
      currentValue,
      targetValue,
      targetYear,
      projectedValue,
      onTrack,
      yearsUntilTarget: onTrack ? yearsRemaining : undefined,
      trendPercentChange,
    };
  }

  private getConfidence(value: number): "high" | "medium" | "low" {
    // Heuristic: measured data (non-zero) gets high confidence
    // Zero or very small values get medium (may be estimated)
    return value > 0 ? "high" : "medium";
  }
}

export const mappingEngine = new FrameworkMappingEngine();
