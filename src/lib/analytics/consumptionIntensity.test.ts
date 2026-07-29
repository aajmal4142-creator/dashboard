import { describe, it, expect } from "vitest";
import {
  calculateEmissionsPerRevenue,
  calculateEmissionsPerEmployee,
  calculateYoYChange,
  analyzeDecoupling,
  calculateIntensityMetrics,
} from "./consumptionIntensity";

describe("consumptionIntensity", () => {
  describe("calculateEmissionsPerRevenue", () => {
    it("calculates correctly", () => {
      // 1000 tCO2e / $10M = 0.1 tCO2e per $M
      const intensity = calculateEmissionsPerRevenue(1000, 10_000_000);
      expect(intensity).toBe(0.1);
    });

    it("handles zero revenue gracefully", () => {
      const intensity = calculateEmissionsPerRevenue(1000, 0);
      expect(intensity).toBe(0);
    });
  });

  describe("calculateEmissionsPerEmployee", () => {
    it("calculates correctly", () => {
      // 1000 tCO2e / 100 employees = 10 tCO2e per employee
      const intensity = calculateEmissionsPerEmployee(1000, 100);
      expect(intensity).toBe(10);
    });

    it("handles zero employees gracefully", () => {
      const intensity = calculateEmissionsPerEmployee(1000, 0);
      expect(intensity).toBe(0);
    });
  });

  describe("calculateYoYChange", () => {
    it("calculates positive change", () => {
      const change = calculateYoYChange(110, 100);
      expect(change).toBe(10);
    });

    it("calculates negative change", () => {
      const change = calculateYoYChange(90, 100);
      expect(change).toBe(-10);
    });

    it("handles zero previous value", () => {
      const change = calculateYoYChange(100, 0);
      expect(change).toBe(0);
    });
  });

  describe("analyzeDecoupling", () => {
    it("detects absolute decoupling", () => {
      const data = [
        { year: 2020, emissions: 1000, driver: 1000 },
        { year: 2024, emissions: 800, driver: 1200 },
      ];

      const analysis = analyzeDecoupling(data);
      expect(analysis.periods[0].decoupling).toBe("absolute");
      expect(analysis.summary).toContain("Absolute decoupling");
    });

    it("detects relative decoupling", () => {
      const data = [
        { year: 2020, emissions: 1000, driver: 1000 },
        { year: 2024, emissions: 1100, driver: 1200 },
      ];

      const analysis = analyzeDecoupling(data);
      expect(analysis.periods[0].decoupling).toBe("relative");
      expect(analysis.summary).toContain("Relative decoupling");
    });

    it("detects no decoupling", () => {
      const data = [
        { year: 2020, emissions: 1000, driver: 1000 },
        { year: 2024, emissions: 1200, driver: 1100 },
      ];

      const analysis = analyzeDecoupling(data);
      expect(analysis.periods[0].decoupling).toBe("none");
      expect(analysis.summary).toContain("No decoupling");
    });
  });

  describe("calculateIntensityMetrics", () => {
    it("calculates all metrics correctly", () => {
      const data = [
        {
          year: 2022,
          emissions: 1000,
          revenue: 10_000_000,
          employees: 100,
          productionUnits: 1000,
        },
        {
          year: 2023,
          emissions: 950,
          revenue: 12_000_000,
          employees: 120,
          productionUnits: 1200,
        },
      ];

      const metrics = calculateIntensityMetrics(data);

      expect(metrics.perRevenue).toBeDefined();
      expect(metrics.perEmployee).toBeDefined();
      expect(metrics.perUnit).toBeDefined();
      expect(metrics.trends).toHaveLength(2);
      expect(metrics.decoupling).toBeDefined();
    });

    it("checks target vs actual", () => {
      const data = [
        {
          year: 2023,
          emissions: 950,
          revenue: 10_000_000,
          employees: 100,
        },
      ];

      const metrics = calculateIntensityMetrics(data, {
        perRevenue: 0.12,
      });

      expect(metrics.targetVsActual.onTrack).toBe(true);
    });

    it("flags when off target", () => {
      const data = [
        {
          year: 2023,
          emissions: 950,
          revenue: 10_000_000,
          employees: 100,
        },
      ];

      const metrics = calculateIntensityMetrics(data, {
        perRevenue: 0.08,
      });

      expect(metrics.targetVsActual.onTrack).toBe(false);
    });
  });
});
