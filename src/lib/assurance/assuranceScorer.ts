import type {
  AssuranceLevel,
  ConfidenceReport,
  DataGap,
  VerificationFinding,
} from "./types";
import { FindingsSeverityScorer } from "./severityScorer";

export class AssuranceScorer {
  private severityScorer: FindingsSeverityScorer;

  constructor() {
    this.severityScorer = new FindingsSeverityScorer();
  }

  /**
   * Calculate overall assurance confidence score (0-100)
   * Based on: findings severity, data gaps, coverage, and data quality
   */
  calculateAssuranceScore(
    findings: VerificationFinding[],
    dataGaps: DataGap[],
    coverage: number = 100,
  ): number {
    let score = 100;

    // Deduct for findings (40% impact)
    const findingsDeduction = this.calculateFindingsImpact(findings);
    score -= findingsDeduction * 0.4;

    // Deduct for data gaps (30% impact)
    const gapDeduction = this.calculateGapsImpact(dataGaps);
    score -= gapDeduction * 0.3;

    // Deduct for coverage gaps (20% impact)
    const coverageDeduction = 100 - coverage;
    score -= coverageDeduction * 0.2;

    // Boost if critical issues are resolved (10% impact)
    const resolutionBoost = this.calculateResolutionBoost(findings);
    score += resolutionBoost * 0.1;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate impact of findings on score (0-100)
   */
  private calculateFindingsImpact(findings: VerificationFinding[]): number {
    if (findings.length === 0) return 0;

    const severity = this.severityScorer.aggregateSeverity(findings);

    // Critical findings = max deduction
    if (severity.criticalCount > 0) {
      return 100 - 20 / severity.criticalCount; // Even 1 critical = -80 points
    }

    // Major findings
    if (severity.majorCount > 0) {
      return Math.min(60, severity.majorCount * 20);
    }

    // Minor findings
    if (severity.minorCount > 0) {
      return Math.min(30, severity.minorCount * 10);
    }

    // Info only
    return Math.min(10, severity.infoCount * 2);
  }

  /**
   * Calculate impact of data gaps on score (0-100)
   */
  private calculateGapsImpact(dataGaps: DataGap[]): number {
    if (dataGaps.length === 0) return 0;

    const criticalGaps = dataGaps.filter((g) => g.severity === "high").length;
    const mediumGaps = dataGaps.filter((g) => g.severity === "medium").length;
    const lowGaps = dataGaps.filter((g) => g.severity === "low").length;

    return (
      Math.min(100, criticalGaps * 30) +
      Math.min(50, mediumGaps * 15) +
      Math.min(10, lowGaps * 5)
    );
  }

  /**
   * Calculate boost for resolved issues (0-100)
   */
  private calculateResolutionBoost(findings: VerificationFinding[]): number {
    const resolved = findings.filter(
      (f) => f.status === "resolved" || f.status === "closed",
    ).length;
    const total = findings.length;

    if (total === 0) return 0;

    return (resolved / total) * 50; // Max 50 point boost
  }

  /**
   * Determine assurance level based on score
   */
  determineAssuranceLevel(score: number): AssuranceLevel {
    // Reasonable assurance: high confidence (70+)
    if (score >= 70) return "reasonable";

    // Limited assurance: lower confidence (below 70)
    return "limited";
  }

  /**
   * Generate comprehensive assurance confidence report
   */
  generateConfidenceReport(
    findings: VerificationFinding[],
    dataGaps: DataGap[],
    coverage: number = 100,
  ): ConfidenceReport {
    const assuranceScore = this.calculateAssuranceScore(findings, dataGaps, coverage);
    const assuranceLevel = this.determineAssuranceLevel(assuranceScore);

    // Assess data gap impact
    const criticalGaps = dataGaps.filter((g) => g.severity === "high").length;
    const dataGapImpact: "high" | "medium" | "low" =
      criticalGaps > 0 ? "high" : dataGaps.length > 0 ? "medium" : "low";

    // Assess findings risk
    const severity = this.severityScorer.aggregateSeverity(findings);
    const findingsRisk: "high" | "medium" | "low" =
      severity.criticalCount > 0 ? "high" : severity.majorCount > 0 ? "medium" : "low";

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      findings,
      dataGaps,
      coverage,
      assuranceScore,
    );

    return {
      assuranceScore,
      assuranceLevel,
      dataGapImpact,
      findingsRisk,
      coveragePercentage: coverage,
      recommendations,
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    findings: VerificationFinding[],
    dataGaps: DataGap[],
    coverage: number,
    score: number,
  ): string[] {
    const recommendations: string[] = [];

    // Critical findings recommendations
    const criticalFindings = this.severityScorer.criticalFindings(findings);
    if (criticalFindings.length > 0) {
      recommendations.push(
        `Address ${criticalFindings.length} critical finding(s) before publishing assurance report`,
      );
    }

    // Data gap recommendations
    const criticalGaps = dataGaps.filter((g) => g.severity === "high");
    if (criticalGaps.length > 0) {
      recommendations.push(
        `Collect missing data for ${criticalGaps.length} critical metric(s)`,
      );
    }

    // Coverage recommendations
    if (coverage < 80) {
      recommendations.push(
        `Improve data coverage from ${Math.round(coverage)}% to at least 80% for reasonable assurance`,
      );
    }

    // Score-based recommendations
    if (score < 50) {
      recommendations.push(
        "Conduct comprehensive audit to address underlying data quality issues",
      );
    } else if (score < 70) {
      recommendations.push(
        "Resolve major findings and collect missing data to achieve reasonable assurance",
      );
    } else if (score < 90) {
      recommendations.push("Consider periodic re-assessment to maintain assurance level");
    }

    // Resolution recommendations
    const openCount = this.severityScorer.openFindings(findings).length;
    if (openCount > 0) {
      recommendations.push(`Track resolution of ${openCount} open finding(s)`);
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  /**
   * Assess overall assurance readiness
   */
  assessReadiness(
    findings: VerificationFinding[],
    dataGaps: DataGap[],
    coverage: number,
  ): {
    isReady: boolean;
    blockers: string[];
    warnings: string[];
  } {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Check for critical findings
    const criticalFindings = this.severityScorer.criticalFindings(findings);
    if (criticalFindings.length > 0) {
      blockers.push(
        `${criticalFindings.length} critical finding(s) must be resolved before sign-off`,
      );
    }

    // Check for critical data gaps
    const criticalGaps = dataGaps.filter((g) => g.severity === "high");
    if (criticalGaps.length > 0) {
      blockers.push(`${criticalGaps.length} critical data gap(s) must be addressed`);
    }

    // Check coverage
    if (coverage < 70) {
      blockers.push("Data coverage must be at least 70% for sign-off");
    }

    // Warnings for non-critical issues
    const majorFindings = this.severityScorer.filterBySeverity(findings, "major");
    if (majorFindings.length > 3) {
      warnings.push(
        `Multiple major findings (${majorFindings.length}) should be addressed`,
      );
    }

    const mediumGaps = dataGaps.filter((g) => g.severity === "medium");
    if (mediumGaps.length > 2) {
      warnings.push(`Several medium-severity data gaps identified`);
    }

    return {
      isReady: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  /**
   * Compare two assurance scores
   */
  compare(
    scoreA: number,
    scoreB: number,
  ): { improved: boolean; change: number; message: string } {
    const change = scoreB - scoreA;
    const improved = change > 0;
    const absChange = Math.abs(change);

    let message = "";
    if (absChange < 5) {
      message = "Minor change";
    } else if (absChange < 15) {
      message = "Moderate change";
    } else {
      message = "Significant change";
    }

    return {
      improved,
      change: Math.round(change),
      message: `${message}: ${improved ? "+" : "-"}${Math.round(absChange)} points`,
    };
  }
}
