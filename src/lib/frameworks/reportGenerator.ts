import type {
  ESGFramework,
  FrameworkReport,
  FrameworkMetricValue,
  ComplianceScore,
  ComplianceTarget,
  TrajectoryAnalysis,
  ComplianceStatement,
  SummaryReport,
} from "./types";
import { complianceChecker } from "./complianceChecker";

export interface ReportOptions {
  includeTechnicalDetails?: boolean;
  includeRecommendations?: boolean;
  includeHistoricalComparison?: boolean;
}

export class ReportGenerator {
  async generateFrameworkReport(
    framework: ESGFramework,
    metrics: FrameworkMetricValue[],
    targets: ComplianceTarget[],
    _options: ReportOptions = {},
  ): Promise<FrameworkReport> {
    const score = await complianceChecker.getComplianceScore(framework, metrics);
    const gaps = await complianceChecker.identifyDataGaps(framework, metrics);
    const checklist = await complianceChecker.getComplianceChecklist(framework);

    // Simulated trajectory (would use real historical data in production)
    const currentValue = metrics
      .filter((m) => m.metricKey.includes("scope1") || m.metricKey.includes("scope2"))
      .reduce((sum, m) => sum + m.value, 0);

    const trajectory: TrajectoryAnalysis = {
      framework,
      currentValue,
      targetValue: currentValue * 0.8, // 20% reduction target
      targetYear: new Date().getFullYear() + 5,
      projectedValue: currentValue * 0.85, // Estimated based on trend
      onTrack: false,
      trendPercentChange: -2.5,
    };

    return {
      framework,
      periodId: "current",
      generatedAt: new Date(),
      metrics,
      complianceScore: score,
      targets: targets.filter((t) => t.framework === framework),
      trajectory,
      dataGaps: gaps,
      checklist,
    };
  }

  async generateMultiFrameworkSummary(
    frameworks: ESGFramework[],
    metricsMap: Record<ESGFramework, FrameworkMetricValue[]>,
  ): Promise<SummaryReport> {
    const scores = {} as Record<ESGFramework, ComplianceScore>;
    let totalScore = 0;

    for (const framework of frameworks) {
      const metrics = metricsMap[framework] || [];
      scores[framework] = await complianceChecker.getComplianceScore(framework, metrics);
      totalScore += scores[framework].score;
    }

    const overallCompliance = Math.round(totalScore / frameworks.length);

    const highlights = this.generateHighlights(scores);
    const recommendations = this.generateRecommendations(scores);

    return {
      periodId: "current",
      generatedAt: new Date(),
      overallCompliance,
      frameworks: scores,
      highlights,
      recommendations,
    };
  }

  async generateComplianceStatement(
    framework: ESGFramework,
    score: ComplianceScore,
  ): Promise<ComplianceStatement> {
    const statements: Record<ESGFramework, string> = {
      csrd: "This report demonstrates our commitment to CSRD compliance by disclosing Scope 1, 2, and 3 emissions with clear metrics and reduction targets.",
      brsr: "We confirm our compliance with BRSR requirements by reporting total GHG emissions, intensity metrics, and renewable energy percentage.",
      gri: "Our GRI-compliant disclosure provides transparent reporting of direct and indirect emissions across all operational boundaries.",
      sasb: "This SASB-aligned report identifies material climate risks and reports industry-specific emissions metrics.",
    };

    const nextSteps: Record<ESGFramework, string[]> = {
      csrd: [
        "Complete carbon footprint audit for missing Scope 3 categories",
        "Establish science-based reduction targets aligned with CSRD expectations",
        "Implement carbon management system for continuous monitoring",
      ],
      brsr: [
        "Enhance data quality for intensity metrics calculation",
        "Increase renewable energy sourcing",
        "Develop water and waste reduction programs",
      ],
      gri: [
        "Expand Scope 3 emissions coverage",
        "Implement third-party verification process",
        "Set up year-over-year comparison tracking",
      ],
      sasb: [
        "Conduct materiality assessment for industry-specific risks",
        "Develop climate risk management strategy",
        "Report climate-related capital expenditures",
      ],
    };

    return {
      framework,
      periodId: "current",
      statement: statements[framework],
      score: score.score,
      status: score.status,
      nextSteps: nextSteps[framework],
    };
  }

  private generateHighlights(scores: Record<ESGFramework, ComplianceScore>): string[] {
    const highlights: string[] = [];

    Object.entries(scores).forEach(([framework, score]) => {
      if (score.score === 100) {
        highlights.push(`✓ Full compliance with ${framework.toUpperCase()}`);
      } else if (score.score >= 75) {
        highlights.push(`✓ Strong ${framework.toUpperCase()} coverage (${score.score}%)`);
      }
    });

    const avgScore = Math.round(
      Object.values(scores).reduce((sum, s) => sum + s.score, 0) /
        Object.keys(scores).length,
    );
    highlights.push(`Overall compliance: ${avgScore}%`);

    return highlights;
  }

  private generateRecommendations(
    scores: Record<ESGFramework, ComplianceScore>,
  ): string[] {
    const recommendations: string[] = [];

    Object.entries(scores).forEach(([framework, score]) => {
      if (score.score < 100) {
        const gap = score.metricsRequired - score.metricsProvided;
        recommendations.push(
          `Collect missing metrics for ${framework.toUpperCase()}: ${gap} metrics needed`,
        );
      }
    });

    recommendations.push("Implement automated emissions tracking system");
    recommendations.push("Schedule quarterly compliance reviews");
    recommendations.push("Engage external auditor for third-party verification");

    return recommendations;
  }
}

export const reportGenerator = new ReportGenerator();
