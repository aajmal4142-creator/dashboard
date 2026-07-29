import type {
  FindingSeverity,
  SeverityLevel,
  VerificationFinding,
  ScoringContext,
} from "./types";

export interface PartialFinding {
  category: string;
  impact?: "high" | "medium" | "low";
  affectedMetric?: string;
  description?: string;
}

export class FindingsSeverityScorer {
  /**
   * Calculate severity based on impact, category, and context
   */
  scoreSeverity(finding: PartialFinding, context: ScoringContext): FindingSeverity {
    let score = 0;

    // Score by impact (50% weight)
    const impactScore = this.scoreImpact(finding.impact);
    score += impactScore * 0.5;

    // Score by category (30% weight)
    const categoryScore = this.scoreCategory(finding.category);
    score += categoryScore * 0.3;

    // Score by context (20% weight)
    const contextScore = this.scoreContext(finding, context);
    score += contextScore * 0.2;

    return this.severityFromScore(score);
  }

  /**
   * Score impact level (0-10)
   */
  private scoreImpact(impact?: "high" | "medium" | "low"): number {
    switch (impact) {
      case "high":
        return 10;
      case "medium":
        return 6;
      case "low":
        return 2;
      default:
        return 5; // Unknown defaults to medium
    }
  }

  /**
   * Score finding category (0-10)
   */
  private scoreCategory(category: string): number {
    // Higher severity for core data issues
    switch (category) {
      case "data-quality":
        return 9; // Data quality issues are most critical
      case "calculation":
        return 8; // Calculation errors are serious
      case "methodology":
        return 7; // Methodology issues
      case "scope":
        return 8; // Scope misalignment
      case "completeness":
        return 6; // Completeness issues
      case "other":
        return 4;
      default:
        return 5;
    }
  }

  /**
   * Score based on context (0-10)
   */
  private scoreContext(finding: PartialFinding, context: ScoringContext): number {
    let score = 5; // Neutral baseline

    // Core scopes (Scope 1 & 2) are more critical than Scope 3
    if (context.scope === "scope1" || context.scope === "scope2") {
      score += 2;
    }

    // If this affects a critical metric, increase severity
    if (finding.affectedMetric && this.isCriticalMetric(finding.affectedMetric)) {
      score += 2;
    }

    // If data coverage is low, increase severity
    if (context.coveragePercentage !== undefined && context.coveragePercentage < 50) {
      score += 2;
    }

    return Math.min(score, 10);
  }

  /**
   * Check if a metric is critical
   */
  private isCriticalMetric(metricKey: string): boolean {
    const criticalMetrics = [
      "scope1",
      "scope2",
      "scope3",
      "total_emissions",
      "emissions_intensity",
      "ghg_intensity",
    ];

    return criticalMetrics.some((m) => metricKey.toLowerCase().includes(m));
  }

  /**
   * Convert numeric score to severity level
   */
  private severityFromScore(score: number): FindingSeverity {
    if (score >= 8) return "critical";
    if (score >= 6) return "major";
    if (score >= 3) return "minor";
    return "info";
  }

  /**
   * Aggregate severity across multiple findings
   */
  aggregateSeverity(findings: VerificationFinding[]): SeverityLevel {
    const counts = {
      critical: 0,
      major: 0,
      minor: 0,
      info: 0,
    };

    for (const finding of findings) {
      counts[finding.severity]++;
    }

    // Calculate aggregate score (weighted)
    const score =
      counts.critical * 10 + counts.major * 6 + counts.minor * 2 + counts.info * 0.5;
    const maxScore = findings.length * 10;
    const normalizedScore = maxScore > 0 ? (score / maxScore) * 100 : 100;

    // Determine overall severity
    let overallSeverity: FindingSeverity = "info";
    if (counts.critical > 0) {
      overallSeverity = "critical";
    } else if (counts.major > 0) {
      overallSeverity = "major";
    } else if (counts.minor > 0) {
      overallSeverity = "minor";
    }

    return {
      overallSeverity,
      criticalCount: counts.critical,
      majorCount: counts.major,
      minorCount: counts.minor,
      infoCount: counts.info,
      score: Math.round(normalizedScore),
    };
  }

  /**
   * Get all findings of a specific severity
   */
  filterBySeverity(
    findings: VerificationFinding[],
    severity: FindingSeverity
  ): VerificationFinding[] {
    return findings.filter((f) => f.severity === severity);
  }

  /**
   * Get critical findings that need immediate attention
   */
  criticalFindings(findings: VerificationFinding[]): VerificationFinding[] {
    return findings.filter((f) => f.severity === "critical");
  }

  /**
   * Get open findings that need resolution
   */
  openFindings(findings: VerificationFinding[]): VerificationFinding[] {
    return findings.filter(
      (f) => f.status === "open" || f.status === "acknowledged"
    );
  }

  /**
   * Calculate resolution rate
   */
  resolutionRate(findings: VerificationFinding[]): number {
    if (findings.length === 0) return 100;

    const resolved = findings.filter(
      (f) => f.status === "resolved" || f.status === "closed"
    ).length;

    return (resolved / findings.length) * 100;
  }

  /**
   * Get findings by category
   */
  groupByCategory(findings: VerificationFinding[]): Record<string, VerificationFinding[]> {
    const grouped: Record<string, VerificationFinding[]> = {};

    for (const finding of findings) {
      if (!grouped[finding.category]) {
        grouped[finding.category] = [];
      }
      grouped[finding.category].push(finding);
    }

    return grouped;
  }
}
