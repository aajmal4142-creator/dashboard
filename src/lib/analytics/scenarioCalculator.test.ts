import { describe, it, expect } from "vitest";
import {
  calculateLeverImpact,
  calculateScenarioImpact,
  runMonteCarloSimulation,
  performSensitivityAnalysis,
  calculatePaybackSchedule,
} from "./scenarioCalculator";

describe("scenarioCalculator", () => {
  const baselineEmissions = 1000; // tCO2e

  describe("calculateLeverImpact", () => {
    it("calculates positive impact for improvement", () => {
      const lever = {
        leverId: "renewable_energy",
        leverName: "Switch to Renewable",
        currentValue: 20,
        targetValue: 50,
        capexRequired: 100000,
        implementationTimeline: 3,
      };

      const impact = calculateLeverImpact(lever, baselineEmissions);
      expect(impact).toBeGreaterThan(0);
      expect(impact).toBeLessThan(baselineEmissions);
    });

    it("returns zero for no change", () => {
      const lever = {
        leverId: "renewable_energy",
        leverName: "Switch to Renewable",
        currentValue: 20,
        targetValue: 20,
        capexRequired: 0,
        implementationTimeline: 1,
      };

      const impact = calculateLeverImpact(lever, baselineEmissions);
      expect(impact).toBe(0);
    });
  });

  describe("calculateScenarioImpact", () => {
    it("calculates realistic scenario impact", () => {
      const variables = [
        {
          leverId: "renewable_energy",
          leverName: "Renewable Energy",
          currentValue: 20,
          targetValue: 80,
          capexRequired: 500000,
          paybackYears: 5,
          implementationTimeline: 3,
        },
        {
          leverId: "energy_efficiency",
          leverName: "Efficiency",
          currentValue: 10,
          targetValue: 30,
          capexRequired: 200000,
          paybackYears: 4,
          implementationTimeline: 2,
        },
      ];

      const impact = calculateScenarioImpact(variables, baselineEmissions, 2030, 2024);

      expect(impact.year1Emissions).toBeGreaterThan(0);
      expect(impact.year1Emissions).toBeLessThan(baselineEmissions);
      expect(impact.year5Emissions).toBeLessThan(impact.year1Emissions);
      expect(impact.totalCapex).toBeGreaterThan(0);
      expect(impact.roi).toBeDefined();
    });

    it("ensures emissions don't go negative", () => {
      const variables = [
        {
          leverId: "renewable_energy",
          leverName: "Renewable Energy",
          currentValue: 0,
          targetValue: 100,
          capexRequired: 1000000,
          paybackYears: 5,
          implementationTimeline: 5,
        },
      ];

      const impact = calculateScenarioImpact(variables, baselineEmissions, 2030, 2024);

      expect(impact.targetYearEmissions).toBeGreaterThan(0);
    });
  });

  describe("runMonteCarloSimulation", () => {
    it("generates confidence intervals", () => {
      const variables = [
        {
          leverId: "renewable_energy",
          leverName: "Renewable Energy",
          currentValue: 20,
          targetValue: 80,
          capexRequired: 500000,
          paybackYears: 5,
          implementationTimeline: 3,
        },
      ];

      const simulation = runMonteCarloSimulation(
        variables,
        baselineEmissions,
        2030,
        2024,
        100, // Lower iterations for test speed
      );

      expect(simulation.results.length).toBe(100);
      expect(simulation.mean).toBeGreaterThan(0);
      expect(simulation.median).toBeGreaterThan(0);
      expect(simulation.stdDev).toBeGreaterThan(0);
      expect(simulation.confidenceIntervals.p50).toBeLessThanOrEqual(
        simulation.confidenceIntervals.p90,
      );
      expect(simulation.confidenceIntervals.p10).toBeLessThanOrEqual(
        simulation.confidenceIntervals.p50,
      );
    });
  });

  describe("performSensitivityAnalysis", () => {
    it("ranks levers by impact", () => {
      const variables = [
        {
          leverId: "renewable_energy",
          leverName: "Renewable Energy",
          currentValue: 20,
          targetValue: 80,
          capexRequired: 500000,
          paybackYears: 5,
          implementationTimeline: 3,
        },
        {
          leverId: "energy_efficiency",
          leverName: "Efficiency",
          currentValue: 10,
          targetValue: 15,
          capexRequired: 50000,
          paybackYears: 4,
          implementationTimeline: 2,
        },
      ];

      const sensitivity = performSensitivityAnalysis(
        variables,
        baselineEmissions,
        2030,
        2024,
      );

      expect(sensitivity.length).toBe(2);
      expect(sensitivity[0]).toHaveProperty("tornadoRank");
      expect(sensitivity[0].tornadoRank).toBeLessThanOrEqual(sensitivity[1].tornadoRank);
    });
  });

  describe("calculatePaybackSchedule", () => {
    it("creates realistic payback schedule", () => {
      const schedule = calculatePaybackSchedule(
        500000, // Total capex
        3, // Years to implement
        100000, // Annual savings
      );

      expect(schedule.length).toBe(10);
      expect(schedule[0]).toHaveProperty("year");
      expect(schedule[0]).toHaveProperty("cumulative");

      // Later years should have higher cumulative savings
      expect(schedule[9].cumulative).toBeGreaterThan(schedule[0].cumulative);
    });
  });
});
