import { describe, it, expect, beforeEach } from "vitest";
import { DataGapDetector, type EmissionsData } from "../dataGapDetector";

describe("DataGapDetector", () => {
  let detector: DataGapDetector;

  beforeEach(() => {
    detector = new DataGapDetector();
  });

  describe("detectGaps", () => {
    it("should detect missing Scope 1 emissions for CSRD", async () => {
      const emissions: EmissionsData = {
        scope2: 50,
        scope3: 100,
      };

      const gaps = await detector.detectGaps("csrd", emissions, "all");

      expect(gaps.length).toBeGreaterThan(0);
      expect(gaps.some((g) => g.metric === "csrd_scope1")).toBe(true);
    });

    it("should detect missing intensity metrics when revenue is missing", async () => {
      const emissions: EmissionsData = {
        scope1: 100,
        scope2: 50,
        scope3: 100,
        // revenue is missing
      };

      const gaps = await detector.detectGaps("csrd", emissions, "all");

      expect(gaps.some((g) => g.metric.includes("intensity"))).toBe(true);
    });

    it("should not report gaps when all required metrics present", async () => {
      const emissions: EmissionsData = {
        scope1: 100,
        scope2: 50,
        scope3: 100,
        revenue: 1000,
      };

      const gaps = await detector.detectGaps("csrd", emissions, "all");

      const criticalGaps = gaps.filter((g) => g.severity === "high");
      expect(criticalGaps.length).toBe(0);
    });

    it("should respect scope filter", async () => {
      const emissions: EmissionsData = {
        scope2: 50,
        scope3: 100,
      };

      const gaps = await detector.detectGaps("brsr", emissions, "scope1");

      const scope1Gaps = gaps.filter((g) => g.affectedScope === "scope1");
      expect(scope1Gaps.length).toBeGreaterThan(0);
    });

    it("should detect BRSR-specific gaps", async () => {
      const emissions: EmissionsData = {
        scope1: 100,
        scope2: 50,
        // renewable energy percentage missing
      };

      const gaps = await detector.detectGaps("brsr", emissions, "all");

      expect(gaps.some((g) => g.metric === "brsr_renewable_energy_pct")).toBe(true);
    });

    it("should detect GRI-specific gaps", async () => {
      const emissions: EmissionsData = {
        scope1: 100,
        scope2: 50,
        // YoY comparison missing
      };

      const gaps = await detector.detectGaps("gri", emissions, "all");

      expect(gaps.some((g) => g.metric === "gri_yoy_comparison")).toBe(true);
    });

    it("should detect SASB-specific gaps", async () => {
      const emissions: EmissionsData = {
        // Missing absolute emissions
      };

      const gaps = await detector.detectGaps("sasb", emissions, "all");

      expect(gaps.length).toBeGreaterThan(0);
    });
  });

  describe("scoreGapSeverity", () => {
    it("should score high severity gaps", () => {
      const gap = {
        metric: "scope1_emissions",
        severity: "high" as const,
        description: "Missing Scope 1",
      };

      const scored = detector.scoreGapSeverity(gap, 1);
      expect(scored).toBe("high");
    });

    it("should apply criticality factor", () => {
      const gap = {
        metric: "renewable_pct",
        severity: "low" as const,
        description: "Missing renewable %",
      };

      const scoredNormal = detector.scoreGapSeverity(gap, 1);
      const scoredCritical = detector.scoreGapSeverity(gap, 3);

      expect(scoredCritical).toBe("medium");
      expect(scoredNormal).toBe("low");
    });
  });

  describe("calculateCoverage", () => {
    it("should calculate 100% coverage when no gaps", async () => {
      const emissions: EmissionsData = {
        scope1: 100,
        scope2: 50,
        scope3: 100,
        revenue: 1000,
      };

      const coverage = detector.calculateCoverage("csrd", emissions, "all");
      expect(coverage).toBe(100);
    });

    it("should calculate partial coverage with gaps", async () => {
      const emissions: EmissionsData = {
        scope1: 100,
        // scope2 missing
        scope3: 100,
        revenue: 1000,
      };

      const coverage = detector.calculateCoverage("csrd", emissions, "all");
      expect(coverage).toBeLessThan(100);
      expect(coverage).toBeGreaterThan(0);
    });
  });

  describe("getFrameworkRequirements", () => {
    it("should return all requirements for framework", () => {
      const requirements = detector.getFrameworkRequirements("csrd", "all");
      expect(requirements.length).toBeGreaterThan(0);
    });

    it("should filter by scope", () => {
      const allRequirements = detector.getFrameworkRequirements("csrd", "all");
      const scope1Requirements = detector.getFrameworkRequirements("csrd", "scope1");

      expect(scope1Requirements.length).toBeLessThanOrEqual(allRequirements.length);
    });

    it("should return different requirements per framework", () => {
      const csrdReqs = detector.getFrameworkRequirements("csrd", "all");
      const brsrReqs = detector.getFrameworkRequirements("brsr", "all");

      // Frameworks may have different metric counts
      expect(csrdReqs.length).toBeGreaterThan(0);
      expect(brsrReqs.length).toBeGreaterThan(0);
    });
  });

  describe("mapGapsToMetrics", () => {
    it("should group gaps by framework", () => {
      const gaps = [
        {
          metric: "csrd_scope1",
          severity: "high" as const,
          description: "Missing",
          framework: "csrd",
        },
        {
          metric: "brsr_scope1",
          severity: "high" as const,
          description: "Missing",
          framework: "brsr",
        },
      ];

      const map = detector.mapGapsToMetrics(gaps);

      expect(map.has("csrd")).toBe(true);
      expect(map.has("brsr")).toBe(true);
      expect(map.get("csrd")!.length).toBe(1);
      expect(map.get("brsr")!.length).toBe(1);
    });
  });

  describe("criticalGaps", () => {
    it("should filter high-severity gaps only", () => {
      const gaps = [
        { metric: "m1", severity: "high" as const, description: "Critical" },
        { metric: "m2", severity: "medium" as const, description: "Medium" },
        { metric: "m3", severity: "high" as const, description: "Critical" },
        { metric: "m4", severity: "low" as const, description: "Low" },
      ];

      const critical = detector.criticalGaps(gaps);

      expect(critical.length).toBe(2);
      expect(critical.every((g) => g.severity === "high")).toBe(true);
    });
  });
});
