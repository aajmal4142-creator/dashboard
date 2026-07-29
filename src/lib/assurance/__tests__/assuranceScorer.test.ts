import { describe, it, expect, beforeEach } from "vitest";
import { AssuranceScorer } from "../assuranceScorer";
import type { VerificationFinding, DataGap } from "../types";

describe("AssuranceScorer", () => {
  let scorer: AssuranceScorer;

  beforeEach(() => {
    scorer = new AssuranceScorer();
  });

  describe("calculateAssuranceScore", () => {
    it("should return 100 with no findings or gaps", () => {
      const findings: VerificationFinding[] = [];
      const gaps: DataGap[] = [];

      const score = scorer.calculateAssuranceScore(findings, gaps, 100);
      expect(score).toBe(100);
    });

    it("should deduct points for critical findings", () => {
      const findings: VerificationFinding[] = [
        {
          engagement: "eng1",
          category: "data-quality",
          severity: "critical",
          title: "Critical issue",
          description: "Major problem",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
      ];

      const score = scorer.calculateAssuranceScore(findings, [], 100);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should deduct points for data gaps", () => {
      const gaps: DataGap[] = [
        {
          metric: "scope1_emissions",
          severity: "high",
          description: "Missing critical data",
        },
      ];

      const score = scorer.calculateAssuranceScore([], gaps, 100);
      expect(score).toBeLessThan(100);
    });

    it("should deduct points for low coverage", () => {
      const score = scorer.calculateAssuranceScore([], [], 50);
      expect(score).toBeLessThan(100);
    });
  });

  describe("determineAssuranceLevel", () => {
    it("should return reasonable for high scores", () => {
      const level = scorer.determineAssuranceLevel(80);
      expect(level).toBe("reasonable");
    });

    it("should return limited for low scores", () => {
      const level = scorer.determineAssuranceLevel(60);
      expect(level).toBe("limited");
    });

    it("should use 70 as threshold", () => {
      expect(scorer.determineAssuranceLevel(70)).toBe("reasonable");
      expect(scorer.determineAssuranceLevel(69)).toBe("limited");
    });
  });

  describe("generateConfidenceReport", () => {
    it("should generate comprehensive report", () => {
      const findings: VerificationFinding[] = [];
      const gaps: DataGap[] = [];

      const report = scorer.generateConfidenceReport(findings, gaps, 100);

      expect(report.assuranceScore).toBeDefined();
      expect(report.assuranceLevel).toBeDefined();
      expect(report.coveragePercentage).toBe(100);
      expect(report.recommendations).toBeDefined();
    });

    it("should provide recommendations for critical issues", () => {
      const findings: VerificationFinding[] = [
        {
          engagement: "eng1",
          category: "data-quality",
          severity: "critical",
          title: "Critical",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
      ];

      const report = scorer.generateConfidenceReport(findings, [], 100);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(
        report.recommendations.some((r) => r.includes("critical"))
      ).toBe(true);
    });
  });

  describe("assessReadiness", () => {
    it("should block sign-off with critical findings", () => {
      const findings: VerificationFinding[] = [
        {
          engagement: "eng1",
          category: "data-quality",
          severity: "critical",
          title: "Critical",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
      ];

      const readiness = scorer.assessReadiness(findings, [], 100);

      expect(readiness.isReady).toBe(false);
      expect(readiness.blockers.length).toBeGreaterThan(0);
    });

    it("should allow sign-off with no blockers", () => {
      const findings: VerificationFinding[] = [];
      const gaps: DataGap[] = [];

      const readiness = scorer.assessReadiness(findings, gaps, 100);

      expect(readiness.isReady).toBe(true);
      expect(readiness.blockers.length).toBe(0);
    });

    it("should warn on multiple major findings", () => {
      const findings: VerificationFinding[] = [
        {
          engagement: "eng1",
          category: "data-quality",
          severity: "major",
          title: "Major 1",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
        {
          engagement: "eng1",
          category: "methodology",
          severity: "major",
          title: "Major 2",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
        {
          engagement: "eng1",
          category: "scope",
          severity: "major",
          title: "Major 3",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
        {
          engagement: "eng1",
          category: "calculation",
          severity: "major",
          title: "Major 4",
          description: "Test",
          status: "open",
          submittedBy: "user1",
          submittedAt: new Date(),
        },
      ];

      const readiness = scorer.assessReadiness(findings, [], 100);

      expect(readiness.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("compare", () => {
    it("should detect improvement", () => {
      const comparison = scorer.compare(60, 75);

      expect(comparison.improved).toBe(true);
      expect(comparison.change).toBe(15);
    });

    it("should detect decline", () => {
      const comparison = scorer.compare(80, 65);

      expect(comparison.improved).toBe(false);
      expect(comparison.change).toBe(-15);
    });

    it("should classify as minor change", () => {
      const comparison = scorer.compare(75, 77);

      expect(comparison.message).toContain("Minor");
    });
  });
});
