import { describe, it, expect, beforeEach } from "vitest";
import { FindingsSeverityScorer } from "../severityScorer";
import type { VerificationFinding } from "../types";

describe("FindingsSeverityScorer", () => {
  let scorer: FindingsSeverityScorer;

  beforeEach(() => {
    scorer = new FindingsSeverityScorer();
  });

  describe("scoreSeverity", () => {
    it("should score high impact data quality issues as critical", () => {
      const finding = {
        category: "data-quality",
        impact: "high" as const,
        affectedMetric: "scope1_emissions",
        description: "Missing critical data",
      };

      const context = {
        scope: "scope1" as const,
        framework: "csrd",
        coveragePercentage: 50,
      };

      const severity = scorer.scoreSeverity(finding, context);
      expect(severity).toBe("critical");
    });

    it("should score medium impact methodology issues as major", () => {
      const finding = {
        category: "methodology",
        impact: "medium" as const,
        description: "Unclear methodology",
      };

      const context = { scope: "scope3" as const };

      const severity = scorer.scoreSeverity(finding, context);
      expect(severity).toBe("major");
    });
  });

  describe("aggregateSeverity", () => {
    it("should calculate correct severity counts", () => {
      const findings: VerificationFinding[] = [
        {
          engagement: "eng1",
          category: "data-quality",
          severity: "critical",
          title: "Critical finding",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
      ];

      const severity = scorer.aggregateSeverity(findings);
      expect(severity.criticalCount).toBe(1);
      expect(severity.overallSeverity).toBe("critical");
    });
  });
});
