import { describe, it, expect } from "vitest";
import {
  checkSBTiAlignment,
  generateOptimizedPathway,
  generateMilestonePathway,
  comparePathways,
} from "./pathwayPlanner";

describe("pathwayPlanner", () => {
  describe("checkSBTiAlignment", () => {
    it("detects 1.5C alignment", () => {
      const alignment = checkSBTiAlignment(
        1000, // baseline
        300, // target (70% reduction)
        2024,
        2030,
      );

      expect(alignment.warming1_5C).toBe(true);
      expect(alignment.alignedWith).toContain("1.5°C");
    });

    it("detects 2.0C alignment", () => {
      const alignment = checkSBTiAlignment(
        1000, // baseline
        750, // target (25% reduction)
        2024,
        2030,
      );

      expect(alignment.warming2_0C).toBe(true);
    });

    it("detects no alignment for insufficient reduction", () => {
      const alignment = checkSBTiAlignment(
        1000, // baseline
        950, // target (5% reduction)
        2024,
        2030,
      );

      expect(alignment.warming1_5C).toBe(false);
      expect(alignment.warming2_0C).toBe(false);
      expect(alignment.alignedWith).toContain("No alignment");
    });
  });

  describe("generateOptimizedPathway", () => {
    it("creates realistic pathway with stages", () => {
      const pathway = generateOptimizedPathway(
        1000, // baseline
        300, // target
        2024,
        2030,
        [
          {
            id: "renewable",
            name: "Renewable Energy",
            maxReductionPercentage: 40,
            priority: 1,
          },
          {
            id: "efficiency",
            name: "Efficiency",
            maxReductionPercentage: 30,
            priority: 2,
          },
        ],
      );

      expect(pathway.targetReduction).toBeGreaterThan(0);
      expect(pathway.stages.length).toBeGreaterThan(0);
      expect(pathway.scienceBasedTargetAlignment).toBeDefined();
      expect(pathway.costBenefitAnalysis.totalCapex).toBeGreaterThan(0);

      // Stages should show declining emissions
      const firstStage = pathway.stages[0];
      const lastStage = pathway.stages[pathway.stages.length - 1];
      expect(lastStage.targetEmissions).toBeLessThan(firstStage.targetEmissions);
    });
  });

  describe("generateMilestonePathway", () => {
    it("creates pathway with approval milestones", () => {
      const pathway = generateMilestonePathway(
        1000, // baseline
        300, // target
        2024,
        2030,
      );

      expect(pathway.milestones.length).toBeGreaterThan(0);
      expect(pathway.milestones[0]).toHaveProperty("year");
      expect(pathway.milestones[0]).toHaveProperty("targetEmissions");
      expect(pathway.milestones[0]).toHaveProperty("approvalRequired");

      // Some milestones should require approval
      const requireApproval = pathway.milestones.some((m) => m.approvalRequired);
      expect(requireApproval).toBe(true);
    });
  });

  describe("comparePathways", () => {
    it("recommends best pathway", () => {
      const pathway1 = generateOptimizedPathway(1000, 300, 2024, 2030, [
        { id: "renewable", name: "Renewable", maxReductionPercentage: 40, priority: 1 },
      ]);
      const pathway2 = generateOptimizedPathway(1000, 400, 2024, 2030, [
        { id: "renewable", name: "Renewable", maxReductionPercentage: 20, priority: 1 },
      ]);

      const comparison = comparePathways([pathway1, pathway2]);

      expect(comparison.pathways.length).toBe(2);
      expect(comparison.recommendedPathway).toBeDefined();
      expect(comparison.rationale).toBeDefined();
    });
  });
});
