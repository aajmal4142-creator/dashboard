import { describe, it, expect } from "vitest";
import {
  validateBoundary,
  generateBoundaryNarrative,
  type BoundaryDefinition,
} from "../boundaryValidator";

describe("Boundary Validator", () => {
  describe("validateBoundary", () => {
    it("should accept valid boundary definition", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: "operational-control",
        operationalScope: ["scope1", "scope2", "scope3"],
        includedEntities: ["Head Office", "Plant A"],
        excludedEntities: ["Joint Venture X"],
        excludedReasons: { "Joint Venture X": "Not operated" },
        scope1Sources: ["stationary-combustion", "mobile-combustion"],
        scope2Sources: ["purchased-electricity"],
        scope3Categories: ["purchased-goods-services", "business-travel"],
      };

      const result = validateBoundary(boundary);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should reject missing organizational approach", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: undefined as any,
        operationalScope: ["scope1"],
        includedEntities: ["Entity A"],
        excludedEntities: [],
        excludedReasons: {},
        scope1Sources: ["stationary-combustion"],
        scope2Sources: [],
        scope3Categories: [],
      };

      const result = validateBoundary(boundary);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("Organizational approach"))).toBe(true);
    });

    it("should reject empty operational scope", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: "equity-share",
        operationalScope: [],
        includedEntities: ["Entity A"],
        excludedEntities: [],
        excludedReasons: {},
        scope1Sources: [],
        scope2Sources: [],
        scope3Categories: [],
      };

      const result = validateBoundary(boundary);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("operational scope"))).toBe(true);
    });

    it("should detect overlapping included/excluded entities", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: "financial-control",
        operationalScope: ["scope1"],
        includedEntities: ["Entity A", "Entity B"],
        excludedEntities: ["Entity B"],
        excludedReasons: { "Entity B": "Reason" },
        scope1Sources: ["stationary-combustion"],
        scope2Sources: [],
        scope3Categories: [],
      };

      const result = validateBoundary(boundary);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("cannot be both"))).toBe(true);
    });

    it("should warn about missing Scope 1 sources when Scope 1 included", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: "operational-control",
        operationalScope: ["scope1"],
        includedEntities: ["Entity A"],
        excludedEntities: [],
        excludedReasons: {},
        scope1Sources: [],
        scope2Sources: [],
        scope3Categories: [],
      };

      const result = validateBoundary(boundary);
      expect(result.warnings.some(w => w.includes("Scope 1"))).toBe(true);
    });

    it("should warn about missing exclusion reasons", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: "operational-control",
        operationalScope: ["scope1"],
        includedEntities: ["Entity A"],
        excludedEntities: ["Entity B"],
        excludedReasons: {},
        scope1Sources: ["stationary-combustion"],
        scope2Sources: [],
        scope3Categories: [],
      };

      const result = validateBoundary(boundary);
      expect(result.warnings.some(w => w.includes("exclusion reason"))).toBe(true);
    });
  });

  describe("generateBoundaryNarrative", () => {
    it("should generate proper narrative for valid boundary", () => {
      const boundary: BoundaryDefinition = {
        organizationalApproach: "operational-control",
        operationalScope: ["scope1", "scope2"],
        includedEntities: ["Head Office", "Plant A"],
        excludedEntities: ["Joint Venture"],
        excludedReasons: { "Joint Venture": "Not controlled" },
        scope1Sources: ["stationary-combustion"],
        scope2Sources: ["purchased-electricity"],
        scope3Categories: [],
      };

      const narrative = generateBoundaryNarrative(boundary);
      expect(narrative).toContain("Operational Control");
      expect(narrative).toContain("Head Office");
      expect(narrative).toContain("Joint Venture");
      expect(narrative).toContain("Scope 1");
      expect(narrative).toContain("Scope 2");
    });
  });
});
