import { describe, it, expect } from "vitest";
import { GHG_PROTOCOL_REQUIREMENTS } from "../ghgProtocolRules";

describe("GHG Protocol Rules", () => {
  it("should have exactly 50 requirements", () => {
    expect(GHG_PROTOCOL_REQUIREMENTS.length).toBe(50);
  });

  it("should have unique checkpoint IDs", () => {
    const ids = GHG_PROTOCOL_REQUIREMENTS.map(r => r.checkpointId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(GHG_PROTOCOL_REQUIREMENTS.length);
  });

  it("should have valid categories", () => {
    const validCategories = [
      "scope-boundaries",
      "data-collection",
      "calculation-methods",
      "emission-factors",
      "quality-assurance",
      "documentation",
      "organizational-boundaries",
      "operational-boundaries",
      "restatements",
      "uncertainty",
    ];

    GHG_PROTOCOL_REQUIREMENTS.forEach(req => {
      expect(validCategories).toContain(req.category);
    });
  });

  it("should have applicable scopes", () => {
    GHG_PROTOCOL_REQUIREMENTS.forEach(req => {
      expect(req.applicableScopes.length).toBeGreaterThan(0);
      req.applicableScopes.forEach(scope => {
        expect(["scope1", "scope2", "scope3"]).toContain(scope);
      });
    });
  });

  it("should have requirement text for all requirements", () => {
    GHG_PROTOCOL_REQUIREMENTS.forEach(req => {
      expect(req.requirementText.length).toBeGreaterThan(0);
      expect(req.requirementName.length).toBeGreaterThan(0);
      expect(req.requirementCode.length).toBeGreaterThan(0);
    });
  });

  it("should cover all scope 1, 2, and 3", () => {
    const hasScope1 = GHG_PROTOCOL_REQUIREMENTS.some(r =>
      r.applicableScopes.includes("scope1")
    );
    const hasScope2 = GHG_PROTOCOL_REQUIREMENTS.some(r =>
      r.applicableScopes.includes("scope2")
    );
    const hasScope3 = GHG_PROTOCOL_REQUIREMENTS.some(r =>
      r.applicableScopes.includes("scope3")
    );

    expect(hasScope1).toBe(true);
    expect(hasScope2).toBe(true);
    expect(hasScope3).toBe(true);
  });

  it("should have requirements from each category", () => {
    const categories = new Set(
      GHG_PROTOCOL_REQUIREMENTS.map(r => r.category)
    );
    expect(categories.size).toBeGreaterThanOrEqual(10);
  });
});
