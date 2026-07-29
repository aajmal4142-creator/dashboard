import { describe, it, expect } from "vitest";
import {
  getFrameworkMapping,
  calculateFrameworkComplianceStatus,
  generateFrameworkComplianceNarrative,
} from "../frameworkMapper";

describe("Framework Mapper", () => {
  describe("getFrameworkMapping", () => {
    it("should map GHG-001 to CSRD requirements", () => {
      const mapping = getFrameworkMapping("GHG-001", "csrd");
      expect(mapping.checkpointId).toBe("GHG-001");
      expect(mapping.framework).toBe("csrd");
      expect(mapping.mappedRequirements.length).toBeGreaterThan(0);
      expect(mapping.alignment).toBe("full");
    });

    it("should map GHG-001 to BRSR requirements", () => {
      const mapping = getFrameworkMapping("GHG-001", "brsr");
      expect(mapping.framework).toBe("brsr");
      expect(mapping.mappedRequirements.length).toBeGreaterThan(0);
    });

    it("should map GHG-001 to GRI requirements", () => {
      const mapping = getFrameworkMapping("GHG-001", "gri");
      expect(mapping.framework).toBe("gri");
      expect(mapping.mappedRequirements.length).toBeGreaterThan(0);
    });

    it("should map GHG-001 to SASB requirements", () => {
      const mapping = getFrameworkMapping("GHG-001", "sasb");
      expect(mapping.framework).toBe("sasb");
      expect(mapping.mappedRequirements.length).toBeGreaterThan(0);
    });

    it("should return empty array for unmapped checkpoints", () => {
      const mapping = getFrameworkMapping("GHG-999", "csrd");
      expect(mapping.mappedRequirements.length).toBe(0);
      expect(mapping.alignment).toBe("indirect");
    });
  });

  describe("calculateFrameworkComplianceStatus", () => {
    it("should calculate 100% alignment when all verified", () => {
      const statuses: Record<string, any> = {
        "GHG-001": "verified",
        "GHG-002": "verified",
        "GHG-003": "verified",
      };

      const status = calculateFrameworkComplianceStatus(statuses, "csrd");
      expect(status.alignmentPercentage).toBe(100);
      expect(status.fullyMappedCheckpoints).toBe(3);
    });

    it("should calculate partial alignment when some in progress", () => {
      const statuses: Record<string, any> = {
        "GHG-001": "verified",
        "GHG-002": "in-progress",
        "GHG-003": "not-started",
      };

      const status = calculateFrameworkComplianceStatus(statuses, "csrd");
      expect(status.alignmentPercentage).toBeLessThan(100);
      expect(status.fullyMappedCheckpoints).toBe(1);
      expect(status.partiallyMappedCheckpoints).toBe(1);
    });

    it("should return 0% alignment when all not started", () => {
      const statuses: Record<string, any> = {
        "GHG-001": "not-started",
        "GHG-002": "not-started",
      };

      const status = calculateFrameworkComplianceStatus(statuses, "csrd");
      expect(status.alignmentPercentage).toBe(0);
    });
  });

  describe("generateFrameworkComplianceNarrative", () => {
    it("should generate narrative for high alignment", () => {
      const status = {
        framework: "csrd" as const,
        totalRequirements: 45,
        fullyMappedCheckpoints: 42,
        partiallyMappedCheckpoints: 3,
        alignmentPercentage: 93,
      };

      const narrative = generateFrameworkComplianceNarrative(status);
      expect(narrative).toContain("93%");
      expect(narrative).toContain("highly aligned");
      expect(narrative).toContain("CSRD");
    });

    it("should generate narrative for low alignment", () => {
      const status = {
        framework: "brsr" as const,
        totalRequirements: 45,
        fullyMappedCheckpoints: 15,
        partiallyMappedCheckpoints: 10,
        alignmentPercentage: 33,
      };

      const narrative = generateFrameworkComplianceNarrative(status);
      expect(narrative).toContain("33%");
      expect(narrative).toContain("strengthen");
      expect(narrative).toContain("BRSR");
    });
  });
});
