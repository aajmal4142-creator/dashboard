import { describe, it, expect } from "vitest";
import {
  scoreToRiskTier,
  mapEcoVadisScoreToRisk,
  calculateCompositeRisk,
} from "./scoreMapper";

describe("scoreToRiskTier", () => {
  it("returns low for scores >= 60", () => {
    expect(scoreToRiskTier(100)).toBe("low");
    expect(scoreToRiskTier(60)).toBe("low");
  });

  it("returns medium for scores 45-59", () => {
    expect(scoreToRiskTier(59)).toBe("medium");
    expect(scoreToRiskTier(45)).toBe("medium");
  });

  it("returns high for scores 30-44", () => {
    expect(scoreToRiskTier(44)).toBe("high");
    expect(scoreToRiskTier(30)).toBe("high");
  });

  it("returns critical for scores < 30", () => {
    expect(scoreToRiskTier(29)).toBe("critical");
    expect(scoreToRiskTier(0)).toBe("critical");
  });
});

describe("mapEcoVadisScoreToRisk", () => {
  it("maps high EcoVadis scores to low risk", () => {
    const result = mapEcoVadisScoreToRisk(75);
    expect(result.tier).toBe("low");
    expect(result.flags).toHaveLength(0);
  });

  it("maps low EcoVadis scores to high risk", () => {
    const result = mapEcoVadisScoreToRisk(35);
    expect(result.tier).toBe("high");
    expect(result.flags).toContain("low_ecocadis_score");
  });

  it("flags critical EcoVadis scores", () => {
    const result = mapEcoVadisScoreToRisk(25);
    expect(result.flags).toContain("critical_ecovadis_score");
    expect(result.flags).toContain("low_ecocadis_score");
  });

  it("returns normalized risk score", () => {
    const result = mapEcoVadisScoreToRisk(50);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("calculateCompositeRisk", () => {
  it("calculates weighted composite risk correctly", () => {
    const result = calculateCompositeRisk({
      ecovadisScore: 50,
      industryRisk: 30,
      locationRisk: 40,
      spendRisk: 60,
      trendRisk: 20,
    });

    // 50*0.5 + 30*0.1 + 40*0.1 + 60*0.2 + 20*0.1 = 25 + 3 + 4 + 12 + 2 = 46
    expect(result.score).toBe(46);
  });

  it("clamps score between 0 and 100", () => {
    const highResult = calculateCompositeRisk({
      ecovadisScore: 150,
      industryRisk: 150,
      locationRisk: 150,
      spendRisk: 150,
      trendRisk: 150,
    });
    expect(highResult.score).toBe(100);

    const lowResult = calculateCompositeRisk({
      ecovadisScore: -50,
      industryRisk: -50,
      locationRisk: -50,
      spendRisk: -50,
      trendRisk: -50,
    });
    expect(lowResult.score).toBe(0);
  });

  it("assigns correct risk tier based on composite score", () => {
    expect(
      calculateCompositeRisk({
        ecovadisScore: 70,
        industryRisk: 20,
        locationRisk: 10,
        spendRisk: 10,
        trendRisk: 10,
      }).tier,
    ).toBe("low");
  });
});
