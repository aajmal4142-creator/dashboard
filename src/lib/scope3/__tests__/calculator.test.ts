import { describe, it, expect } from "vitest";
import { Scope3Calculator } from "../calculator";
import type { EmissionsFactor } from "../types";

describe("Scope3Calculator", () => {
  const calculator = new Scope3Calculator();

  const testFactor: EmissionsFactor = {
    value: 0.5,
    unit: "tonne",
    source: "DEFRA",
    year: 2023,
    confidence: "medium",
  };

  describe("calculateActivityEmissions", () => {
    it("should calculate emissions with calculation string", async () => {
      const result = await calculator.calculateActivityEmissions(100, testFactor);
      expect(result.emissions).toBe(50);
      expect(result.calculation).toContain("100");
      expect(result.calculation).toContain("0.5");
    });

    it("should handle decimal values", async () => {
      const result = await calculator.calculateActivityEmissions(100.5, testFactor);
      expect(result.emissions).toBeCloseTo(50.25, 2);
    });

    it("should handle small factors", async () => {
      const smallFactor: EmissionsFactor = {
        ...testFactor,
        value: 0.00015,
        unit: "£",
      };
      const result = await calculator.calculateActivityEmissions(1000, smallFactor);
      expect(result.emissions).toBeCloseTo(0.15, 5);
    });
  });

  describe("calculateTotal", () => {
    it("should sum emissions correctly", () => {
      const activities = [{ emissions: 10 }, { emissions: 20 }, { emissions: 30 }];
      const total = calculator.calculateTotal(activities);
      expect(total).toBe(60);
    });

    it("should handle empty array", () => {
      const total = calculator.calculateTotal([]);
      expect(total).toBe(0);
    });

    it("should handle decimal values", () => {
      const activities = [{ emissions: 10.5 }, { emissions: 20.3 }];
      const total = calculator.calculateTotal(activities);
      expect(total).toBeCloseTo(30.8, 1);
    });
  });

  describe("compareYears", () => {
    it("should calculate year-over-year change", () => {
      const year1 = [{ emissions: 100 }];
      const year2 = [{ emissions: 120 }];
      const result = calculator.compareYears(year1, year2);
      expect(result.year1Total).toBe(100);
      expect(result.year2Total).toBe(120);
      expect(result.change).toBe(20);
      expect(result.percentChange).toBe(20);
    });

    it("should calculate negative change", () => {
      const year1 = [{ emissions: 100 }];
      const year2 = [{ emissions: 80 }];
      const result = calculator.compareYears(year1, year2);
      expect(result.change).toBe(-20);
      expect(result.percentChange).toBe(-20);
    });

    it("should handle zero baseline", () => {
      const year1: Array<{ emissions: number }> = [];
      const year2 = [{ emissions: 100 }];
      const result = calculator.compareYears(year1, year2);
      expect(result.percentChange).toBe(0); // 0 baseline = 0% change
    });
  });

  describe("calculateUncertaintyRange", () => {
    it("should generate uncertainty range", () => {
      const range = calculator.calculateUncertaintyRange(100, "medium", 0.95);
      expect(range.best).toBe(100);
      expect(range.low).toBeGreaterThan(0);
      expect(range.high).toBeGreaterThan(100);
    });

    it("should respect confidence levels", () => {
      const highRange = calculator.calculateUncertaintyRange(100, "high", 0.95);
      const lowRange = calculator.calculateUncertaintyRange(100, "low", 0.95);

      const highWidth = highRange.high - highRange.low;
      const lowWidth = lowRange.high - lowRange.low;
      expect(lowWidth).toBeGreaterThan(highWidth);
    });
  });

  describe("monteCarloUncertainty", () => {
    it("should generate uncertainty via Monte Carlo", async () => {
      const range = await calculator.monteCarloUncertainty(100, testFactor, 100);
      expect(range.best).toBeDefined();
      expect(range.low).toBeDefined();
      expect(range.high).toBeDefined();
      expect(range.low).toBeGreaterThan(0);
      expect(range.high).toBeGreaterThan(range.best);
    });

    it("should handle high confidence factors", async () => {
      const highConfidence: EmissionsFactor = { ...testFactor, confidence: "high" };
      const range = await calculator.monteCarloUncertainty(100, highConfidence, 100);
      const width = range.high - range.low;
      expect(width).toBeGreaterThan(0);
    });
  });

  describe("calculateWeightedAverage", () => {
    it("should calculate weighted average", () => {
      const activities = [
        { emissions: 100, weight: 1 },
        { emissions: 200, weight: 2 },
      ];
      const avg = calculator.calculateWeightedAverage(activities);
      expect(avg).toBeCloseTo(166.67, 1);
    });

    it("should handle equal weights", () => {
      const activities = [
        { emissions: 100, weight: 1 },
        { emissions: 200, weight: 1 },
      ];
      const avg = calculator.calculateWeightedAverage(activities);
      expect(avg).toBe(150);
    });

    it("should return 0 for zero total weight", () => {
      const activities = [{ emissions: 100, weight: 0 }];
      const avg = calculator.calculateWeightedAverage(activities);
      expect(avg).toBe(0);
    });
  });

  describe("aggregateByDimensions", () => {
    it("should aggregate by source", () => {
      const activities = [
        {
          id: "1",
          sourceId: "source-1",
          periodId: "period-1",
          activityData: {},
          calculatedEmissions: 100,
          status: "approved" as const,
          organisationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          sourceId: "source-1",
          periodId: "period-1",
          activityData: {},
          calculatedEmissions: 50,
          status: "approved" as const,
          organisationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = calculator.aggregateByDimensions(activities, "source");
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("source-1");
      expect(result[0].emissions).toBe(150);
      expect(result[0].count).toBe(2);
    });

    it("should aggregate by period", () => {
      const activities = [
        {
          id: "1",
          sourceId: "source-1",
          periodId: "period-1",
          activityData: {},
          calculatedEmissions: 100,
          status: "approved" as const,
          organisationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          sourceId: "source-1",
          periodId: "period-2",
          activityData: {},
          calculatedEmissions: 50,
          status: "approved" as const,
          organisationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = calculator.aggregateByDimensions(activities, "period");
      expect(result).toHaveLength(2);
    });
  });
});
