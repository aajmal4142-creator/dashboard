import { describe, expect, it } from "vitest";

import {
  bandOf,
  clamp,
  computeEScore,
  computeGScore,
  computeOverall,
  computeSScore,
} from "./scores";

describe("clamp", () => {
  it("passes through values already in range", () => {
    expect(clamp(0, 100, 50)).toBe(50);
  });
  it("floors below the minimum", () => {
    expect(clamp(0, 100, -10)).toBe(0);
  });
  it("ceils above the maximum", () => {
    expect(clamp(0, 100, 999)).toBe(100);
  });
});

describe("computeEScore", () => {
  it("gives 100 when there is no carbon intensity and no renewable share", () => {
    const result = computeEScore({ carbonPerEmployeeTco2e: 0, renewablePct: 0 });
    expect(result.score).toBe(100);
  });

  it("applies no penalty until carbon intensity exceeds 1 tCO2e/employee", () => {
    const atThreshold = computeEScore({ carbonPerEmployeeTco2e: 1, renewablePct: 0 });
    expect(atThreshold.score).toBe(100);
  });

  it("clamps at 0 for extreme carbon intensity", () => {
    const result = computeEScore({ carbonPerEmployeeTco2e: 1000, renewablePct: 0 });
    expect(result.score).toBe(0);
  });

  it("clamps at 100 even when renewable bonus would push above it", () => {
    const result = computeEScore({ carbonPerEmployeeTco2e: 0, renewablePct: 100 });
    expect(result.score).toBe(100);
  });

  it("produces breakdown items with matching contributions", () => {
    const result = computeEScore({ carbonPerEmployeeTco2e: 3, renewablePct: 40 });
    const penalty = result.breakdown.find((b) => b.component === "e_carbon_intensity");
    const bonus = result.breakdown.find((b) => b.component === "e_renewable_share");
    expect(penalty?.contribution).toBeCloseTo(-24, 5);
    expect(bonus?.contribution).toBeCloseTo(6, 5);
  });
});

describe("computeSScore", () => {
  it("caps the diversity term at 55 even above 40% diversity", () => {
    const result = computeSScore({
      diversityPct: 100,
      injuryRate: 0,
      trainingHoursPerEmployee: 0,
    });
    const diversity = result.breakdown.find((b) => b.component === "s_diversity");
    expect(diversity?.contribution).toBe(55);
  });

  it("floors the injury term at 0 for a high injury rate", () => {
    const result = computeSScore({
      diversityPct: 0,
      injuryRate: 100,
      trainingHoursPerEmployee: 0,
    });
    const injury = result.breakdown.find((b) => b.component === "s_injury_rate");
    expect(injury?.contribution).toBe(0);
  });

  it("gives the full 35-point injury term when the injury rate is 0", () => {
    const result = computeSScore({
      diversityPct: 0,
      injuryRate: 0,
      trainingHoursPerEmployee: 0,
    });
    const injury = result.breakdown.find((b) => b.component === "s_injury_rate");
    expect(injury?.contribution).toBe(35);
  });

  it("caps the training bonus at 10 points", () => {
    const result = computeSScore({
      diversityPct: 0,
      injuryRate: 0,
      trainingHoursPerEmployee: 1000,
    });
    const training = result.breakdown.find((b) => b.component === "s_training");
    expect(training?.contribution).toBe(10);
  });

  it("clamps the overall S score at 100", () => {
    const result = computeSScore({
      diversityPct: 100,
      injuryRate: 0,
      trainingHoursPerEmployee: 1000,
    });
    expect(result.score).toBe(100);
  });

  it("clamps the overall S score at 0", () => {
    const result = computeSScore({
      diversityPct: -1000,
      injuryRate: 1000,
      trainingHoursPerEmployee: 0,
    });
    expect(result.score).toBe(0);
  });
});

describe("computeGScore", () => {
  it("reaches exactly 100 with a fully independent board and all three policies", () => {
    const result = computeGScore({ boardIndependencePct: 100, policiesTrue: 3 });
    expect(result.score).toBe(100);
  });

  it("is exactly 0 with no independent directors and no policies", () => {
    const result = computeGScore({ boardIndependencePct: 0, policiesTrue: 0 });
    expect(result.score).toBe(0);
  });

  it("gives each policy an equal 16.67-point share", () => {
    const result = computeGScore({ boardIndependencePct: 0, policiesTrue: 1 });
    const policyItem = result.breakdown.find((b) => b.component === "g_policies");
    expect(policyItem?.contribution).toBeCloseTo(16.67, 2);
  });
});

describe("computeOverall", () => {
  it("rounds the mean of E, S, G", () => {
    expect(computeOverall(70, 71, 72)).toBe(71);
    expect(computeOverall(70, 70, 71)).toBe(70);
  });
});

describe("bandOf", () => {
  it("is 'strong' at and above 70", () => {
    expect(bandOf(70)).toBe("strong");
    expect(bandOf(100)).toBe("strong");
  });
  it("is 'moderate' between 45 and 69 inclusive", () => {
    expect(bandOf(69)).toBe("moderate");
    expect(bandOf(45)).toBe("moderate");
  });
  it("is 'early' below 45", () => {
    expect(bandOf(44)).toBe("early");
    expect(bandOf(0)).toBe("early");
  });
});
