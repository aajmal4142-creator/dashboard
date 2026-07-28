import type {
  ESGFramework,
  FrameworkMetricValue,
  AuditResult,
  DataGap,
  Anomaly,
  ChecklistItem,
  ComplianceScore,
} from "./types";
import { mappingEngine } from "./mappingEngine";

export class ComplianceChecker {
  async auditFramework(
    framework: ESGFramework,
    emissions: { scope1: number; scope2: number; scope3: number; total: number },
    metrics: FrameworkMetricValue[],
  ): Promise<AuditResult> {
    const gaps = await this.identifyDataGaps(framework, metrics);
    const anomalies = await this.detectAnomalies(emissions, metrics);
    const missingMetrics = this.getMissingRequiredMetrics(framework, metrics);

    // Confidence level based on data completeness
    const confidenceLevel = Math.max(0, 100 - gaps.length * 10 - anomalies.length * 5);

    return {
      framework,
      missingMetrics,
      dataGaps: gaps,
      anomalies,
      confidenceLevel: Math.min(100, Math.max(0, confidenceLevel)),
    };
  }

  async getComplianceScore(
    framework: ESGFramework,
    metrics: FrameworkMetricValue[],
  ): Promise<ComplianceScore> {
    return mappingEngine.checkCompliance(framework, metrics);
  }

  async identifyDataGaps(
    framework: ESGFramework,
    metrics: FrameworkMetricValue[],
  ): Promise<DataGap[]> {
    const frameworkMetrics = mappingEngine.getFrameworkMetrics(framework);
    const providedKeys = new Set(metrics.map((m) => m.metricKey));
    const gaps: DataGap[] = [];

    frameworkMetrics.forEach((metric) => {
      if (metric.required && !providedKeys.has(metric.metricKey)) {
        gaps.push({
          metricKey: metric.metricKey,
          label: metric.label,
          impact: this.getGapImpact(metric.required),
          estimatedImpactOnScore: 15, // per missing required metric
        });
      }
    });

    return gaps;
  }

  async getComplianceChecklist(framework: ESGFramework): Promise<ChecklistItem[]> {
    const checklist: ChecklistItem[] = [];

    const commonTasks = [
      {
        category: "Data Collection",
        task: "Gather historical emissions data (last 3+ years)",
        priority: "high",
        effort: "2 days",
      },
      {
        category: "Data Collection",
        task: "Identify all emission sources (Scope 1, 2, 3)",
        priority: "high",
        effort: "1 day",
      },
      {
        category: "Data Collection",
        task: "Document data quality and confidence levels",
        priority: "medium",
        effort: "1 day",
      },
      {
        category: "Baseline & Targets",
        task: "Select and document baseline year",
        priority: "high",
        effort: "4 hours",
      },
      {
        category: "Baseline & Targets",
        task: "Define reduction targets and timeline",
        priority: "high",
        effort: "1 day",
      },
      {
        category: "Verification",
        task: "Review data for completeness and accuracy",
        priority: "high",
        effort: "2 days",
      },
    ];

    const frameworkSpecificTasks: Record<ESGFramework, typeof commonTasks> = {
      csrd: [
        {
          category: "CSRD-Specific",
          task: "Calculate GHG intensity (tCO2e/€M revenue)",
          priority: "high",
          effort: "4 hours",
        },
        {
          category: "CSRD-Specific",
          task: "Document biogenic CO2 emissions separately",
          priority: "medium",
          effort: "1 day",
        },
        {
          category: "CSRD-Specific",
          task: "Report carbon removals and offset projects",
          priority: "medium",
          effort: "1 day",
        },
      ],
      brsr: [
        {
          category: "BRSR-Specific",
          task: "Calculate intensity per INR crore revenue",
          priority: "high",
          effort: "4 hours",
        },
        {
          category: "BRSR-Specific",
          task: "Track renewable vs non-renewable energy",
          priority: "high",
          effort: "1 day",
        },
        {
          category: "BRSR-Specific",
          task: "Document energy consumption by type",
          priority: "medium",
          effort: "1 day",
        },
      ],
      gri: [
        {
          category: "GRI-Specific",
          task: "Report Scope 1, 2, 3 emissions separately",
          priority: "high",
          effort: "4 hours",
        },
        {
          category: "GRI-Specific",
          task: "Calculate year-over-year emissions change",
          priority: "medium",
          effort: "4 hours",
        },
        {
          category: "GRI-Specific",
          task: "Document biogenic emissions if applicable",
          priority: "low",
          effort: "4 hours",
        },
      ],
      sasb: [
        {
          category: "SASB-Specific",
          task: "Map emissions by operational category",
          priority: "high",
          effort: "2 days",
        },
        {
          category: "SASB-Specific",
          task: "Calculate absolute + normalized intensity",
          priority: "high",
          effort: "1 day",
        },
        {
          category: "SASB-Specific",
          task: "Assess climate-related materiality and risks",
          priority: "high",
          effort: "2 days",
        },
      ],
    };

    const tasks = [...commonTasks, ...(frameworkSpecificTasks[framework] || [])];

    tasks.forEach((task, idx) => {
      checklist.push({
        id: `${framework}_task_${idx}`,
        category: task.category,
        task: task.task,
        required: task.priority === "high",
        completed: false,
        priority: task.priority as "high" | "medium" | "low",
        estimatedEffort: task.effort,
      });
    });

    return checklist;
  }

  private getMissingRequiredMetrics(
    framework: ESGFramework,
    metrics: FrameworkMetricValue[],
  ): string[] {
    const frameworkMetrics = mappingEngine.getFrameworkMetrics(framework);
    const providedKeys = new Set(metrics.map((m) => m.metricKey));

    return frameworkMetrics
      .filter((m) => m.required && !providedKeys.has(m.metricKey))
      .map((m) => m.metricKey);
  }

  private getGapImpact(required: boolean): "high" | "medium" | "low" {
    return required ? "high" : "medium";
  }

  private async detectAnomalies(
    emissions: { scope1: number; scope2: number; scope3: number; total: number },
    metrics: FrameworkMetricValue[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Simple check: if any metric value is suspiciously high or low
    const maxEmissions = Math.max(emissions.scope1, emissions.scope2, emissions.scope3);
    const avgEmissions = (emissions.scope1 + emissions.scope2 + emissions.scope3) / 3;

    metrics.forEach((metric) => {
      // Threshold: any value > 3x the average is suspicious
      if (maxEmissions > 0 && metric.value > maxEmissions * 3) {
        anomalies.push({
          metricKey: metric.metricKey,
          value: metric.value,
          expected: avgEmissions,
          deviation: Math.abs(metric.value - avgEmissions) / avgEmissions,
          severity: metric.value > maxEmissions * 5 ? "high" : "medium",
        });
      }

      // Negative emissions (except removals)
      if (
        metric.value < 0 &&
        !metric.metricKey.includes("removal") &&
        !metric.metricKey.includes("removal")
      ) {
        anomalies.push({
          metricKey: metric.metricKey,
          value: metric.value,
          expected: 0,
          deviation: Math.abs(metric.value),
          severity: "high",
        });
      }
    });

    return anomalies;
  }
}

export const complianceChecker = new ComplianceChecker();
