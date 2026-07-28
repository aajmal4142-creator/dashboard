import { describe, it, expect } from "vitest";
import { EmissionsFactorService } from "../emissionsFactorService";
import type { Scope3Category, EmissionsFactor } from "../types";

describe("EmissionsFactorService", () => {
  const service = new EmissionsFactorService();

  describe("getDefaultFactor", () => {
    it("should return DEFRA supplier factor", async () => {
      const factor = await service.getDefaultFactor("supplier", "general_procurement");
      expect(factor).toBeTruthy();
      expect(factor?.value).toBe(0.00015);
      expect(factor?.unit).toBe("£");
      expect(factor?.source).toBe("DEFRA");
    });

    it("should return null for non-existent factor", async () => {
      const factor = await service.getDefaultFactor("supplier", "non_existent");
      expect(factor).toBeNull();
    });

    it("should return waste landfill factor", async () => {
      const factor = await service.getDefaultFactor("waste", "landfill");
      expect(factor?.value).toBe(0.5);
    });

    it("should return null for invalid category", async () => {
      const factor = await service.getDefaultFactor("invalid" as Scope3Category, "test");
      expect(factor).toBeNull();
    });
  });

  describe("getFactorsForCategory", () => {
    it("should return all supplier factors", async () => {
      const factors = await service.getFactorsForCategory("supplier");
      expect(factors.length).toBeGreaterThan(0);
      expect(factors.every((f) => f.unit === "£")).toBe(true);
    });

    it("should return all waste factors", async () => {
      const factors = await service.getFactorsForCategory("waste");
      expect(factors.length).toBeGreaterThan(0);
      expect(factors.every((f) => f.unit === "tonne")).toBe(true);
    });

    it("should return empty array for non-existent category", async () => {
      const factors = await service.getFactorsForCategory("invalid" as Scope3Category);
      expect(factors).toEqual([]);
    });
  });

  describe("searchFactors", () => {
    it("should find factors by keyword", async () => {
      const results = await service.searchFactors("air");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find factors by source", async () => {
      const results = await service.searchFactors("DEFRA");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty for non-matching search", async () => {
      const results = await service.searchFactors("xyz123");
      expect(results).toEqual([]);
    });
  });

  describe("calculateEmissions", () => {
    it("should calculate emissions correctly", () => {
      const factor: EmissionsFactor = {
        value: 0.5,
        unit: "tonne",
        source: "DEFRA",
        year: 2023,
      };

      const emissions = service.calculateEmissions(100, factor); // 100 tonnes
      expect(emissions).toBe(50); // 100 * 0.5 = 50 tCO2e
    });

    it("should handle zero activity", () => {
      const factor: EmissionsFactor = {
        value: 0.5,
        unit: "tonne",
        source: "DEFRA",
        year: 2023,
      };

      const emissions = service.calculateEmissions(0, factor);
      expect(emissions).toBe(0);
    });

    it("should handle small values", () => {
      const factor: EmissionsFactor = {
        value: 0.00015,
        unit: "£",
        source: "DEFRA",
        year: 2023,
      };

      const emissions = service.calculateEmissions(1000, factor);
      expect(emissions).toBeCloseTo(0.15, 5);
    });
  });

  describe("calculateUncertaintyRange", () => {
    it("should calculate uncertainty for high confidence", () => {
      const range = service.calculateUncertaintyRange(100, "high", 0.95);
      expect(range.best).toBe(100);
      expect(range.low).toBeGreaterThan(0);
      expect(range.high).toBeGreaterThan(range.best);
      // Check it's approximately symmetric
      const lowDiff = range.best - range.low;
      const highDiff = range.high - range.best;
      expect(highDiff).toBeCloseTo(lowDiff, 1);
    });

    it("should calculate larger range for low confidence", () => {
      const highConfidence = service.calculateUncertaintyRange(100, "high", 0.95);
      const lowConfidence = service.calculateUncertaintyRange(100, "low", 0.95);

      expect(lowConfidence.high - lowConfidence.best).toBeGreaterThan(
        highConfidence.high - highConfidence.best,
      );
    });

    it("should calculate different ranges for 1σ vs 2σ", () => {
      const oneS = service.calculateUncertaintyRange(100, "medium", 0.68);
      const twoS = service.calculateUncertaintyRange(100, "medium", 0.95);

      expect(twoS.high - twoS.best).toBeGreaterThan(oneS.high - oneS.best);
    });
  });
});
