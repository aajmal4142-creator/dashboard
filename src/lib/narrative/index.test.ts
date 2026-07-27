import { describe, expect, it } from "vitest";

import type { CalcResult } from "../calc";
import {
  bandChangeSentence,
  describeBreakdown,
  describeScoreDeltas,
  generateNarrative,
} from "./index";

function result(overrides: Partial<CalcResult> = {}): CalcResult {
  return {
    scores: { overall: 70, e: 70, s: 70, g: 70 },
    emissions: {
      scope1: { value: 10, unit: "tCO2e", quality: "calculated" },
      scope2: { value: 10, unit: "tCO2e", quality: "calculated" },
      scope3: { value: 10, unit: "tCO2e", quality: "calculated" },
      total: { value: 30, unit: "tCO2e", quality: "calculated" },
    },
    dataQualityPct: 80,
    factorsUsed: [],
    breakdown: [
      {
        component: "scope1_diesel",
        contribution: 10,
        explanation: "Diesel contributed 10 tCO2e (100% of Scope 1).",
      },
      {
        component: "e_carbon_intensity",
        contribution: -5,
        explanation:
          "Carbon intensity of 1 tCO2e per employee reduced the E score by 5 points.",
      },
      {
        component: "s_diversity",
        contribution: 40,
        explanation: "Workforce diversity of 30% contributed 40 points to the S score.",
      },
      {
        component: "g_board_independence",
        contribution: 20,
        explanation: "Board independence of 40% contributed 20 points to the G score.",
      },
    ],
    band: "moderate",
    ...overrides,
  };
}

describe("describeBreakdown", () => {
  it("returns one sentence per breakdown item, verbatim", () => {
    const r = result();
    expect(describeBreakdown(r)).toEqual(r.breakdown.map((b) => b.explanation));
  });
});

describe("describeScoreDeltas", () => {
  it("reports 'held steady' for every score when nothing changed", () => {
    const sentences = describeScoreDeltas(result(), result());
    expect(sentences).toEqual([
      "Your E score held steady at 70.",
      "Your S score held steady at 70.",
      "Your G score held steady at 70.",
      "Your Overall score held steady at 70.",
    ]);
  });

  it("uses singular 'point' for a 1-point move and names the largest driver", () => {
    const previous = result({
      scores: { overall: 71, e: 71, s: 70, g: 70 },
      breakdown: [
        {
          component: "e_carbon_intensity",
          contribution: -4,
          explanation:
            "Carbon intensity of 0.8 tCO2e per employee reduced the E score by 4 points.",
        },
      ],
    });
    const current = result({
      scores: { overall: 70, e: 70, s: 70, g: 70 },
      breakdown: [
        {
          component: "e_carbon_intensity",
          contribution: -5,
          explanation:
            "Carbon intensity of 1 tCO2e per employee reduced the E score by 5 points.",
        },
      ],
    });
    const sentences = describeScoreDeltas(current, previous);
    expect(sentences[0]).toBe(
      "Your E score fell 1 point to 70 — the largest mover was: carbon intensity of 1 tCO2e per employee reduced the E score by 5 points.",
    );
  });

  it("uses plural 'points' and 'rose' for a multi-point increase", () => {
    const previous = result({ scores: { overall: 60, e: 60, s: 70, g: 70 } });
    const current = result({ scores: { overall: 70, e: 70, s: 70, g: 70 } });
    const sentences = describeScoreDeltas(current, previous);
    expect(sentences[0]).toContain("Your E score rose 10 points to 70");
  });

  it("omits the driver clause when no matching breakdown component moved", () => {
    const previous = result({
      scores: { overall: 60, e: 60, s: 70, g: 70 },
      breakdown: [],
    });
    const current = result({
      scores: { overall: 70, e: 70, s: 70, g: 70 },
      breakdown: [],
    });
    const sentences = describeScoreDeltas(current, previous);
    expect(sentences[0]).toBe("Your E score rose 10 points to 70.");
  });

  it("omits the driver clause when the matching component's contribution did not change", () => {
    const sharedBreakdown = [
      {
        component: "e_renewable_share",
        contribution: 9,
        explanation: "Renewable electricity share of 60% added 9 points to the E score.",
      },
    ];
    const previous = result({
      scores: { overall: 60, e: 60, s: 70, g: 70 },
      breakdown: sharedBreakdown,
    });
    const current = result({
      scores: { overall: 70, e: 70, s: 70, g: 70 },
      breakdown: sharedBreakdown,
    });
    const sentences = describeScoreDeltas(current, previous);
    expect(sentences[0]).toBe("Your E score rose 10 points to 70.");
  });
});

describe("bandChangeSentence", () => {
  it("is null when the band is unchanged", () => {
    expect(
      bandChangeSentence(result({ band: "moderate" }), result({ band: "moderate" })),
    ).toBeNull();
  });

  it("describes a band change", () => {
    const sentence = bandChangeSentence(
      result({ band: "strong" }),
      result({ band: "moderate" }),
    );
    expect(sentence).toBe("Your compliance band moved from moderate to strong.");
  });
});

describe("generateNarrative", () => {
  it("returns only the breakdown sentences when there is no previous period", () => {
    const r = result();
    expect(generateNarrative(r)).toEqual(describeBreakdown(r));
  });

  it("appends emissions, data-quality, and band sentences when a previous period is given", () => {
    const previous = result({
      emissions: {
        scope1: { value: 5, unit: "tCO2e", quality: "calculated" },
        scope2: { value: 5, unit: "tCO2e", quality: "calculated" },
        scope3: { value: 5, unit: "tCO2e", quality: "calculated" },
        total: { value: 15, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 60,
      band: "early",
    });
    const current = result({ dataQualityPct: 80, band: "moderate" });

    const sentences = generateNarrative(current, previous);
    expect(sentences).toContain("Total emissions rose from 15 to 30 tCO2e (100%).");
    expect(sentences).toContain("Data quality improved from 60% to 80%.");
    expect(sentences).toContain("Your compliance band moved from early to moderate.");
  });

  it("reports a decline in data quality", () => {
    const previous = result({ dataQualityPct: 90 });
    const current = result({ dataQualityPct: 70 });
    expect(generateNarrative(current, previous)).toContain(
      "Data quality declined from 90% to 70%.",
    );
  });

  it("states emissions held steady when the total is unchanged", () => {
    const sentences = generateNarrative(result(), result());
    expect(sentences).toContain("Total emissions held steady at 30 tCO2e.");
  });

  it("reports emissions falling when the total decreases", () => {
    const previous = result({
      emissions: {
        scope1: { value: 20, unit: "tCO2e", quality: "calculated" },
        scope2: { value: 20, unit: "tCO2e", quality: "calculated" },
        scope3: { value: 20, unit: "tCO2e", quality: "calculated" },
        total: { value: 60, unit: "tCO2e", quality: "calculated" },
      },
    });
    const sentences = generateNarrative(result(), previous);
    expect(sentences).toContain("Total emissions fell from 60 to 30 tCO2e (50%).");
  });

  it("treats a component present only in the current period as a full, not partial, mover", () => {
    const previous = result({
      scores: { overall: 60, e: 60, s: 70, g: 70 },
      breakdown: [],
    });
    const current = result({
      scores: { overall: 70, e: 70, s: 70, g: 70 },
      breakdown: [
        {
          component: "e_renewable_share",
          contribution: 12,
          explanation:
            "Renewable electricity share of 80% added 12 points to the E score.",
        },
      ],
    });
    const sentences = describeScoreDeltas(current, previous);
    expect(sentences[0]).toBe(
      "Your E score rose 10 points to 70 — the largest mover was: renewable electricity share of 80% added 12 points to the E score.",
    );
  });

  it("omits a percentage when the previous total was zero", () => {
    const previous = result({
      emissions: {
        scope1: { value: 0, unit: "tCO2e", quality: "missing" },
        scope2: { value: 0, unit: "tCO2e", quality: "missing" },
        scope3: { value: 0, unit: "tCO2e", quality: "missing" },
        total: { value: 0, unit: "tCO2e", quality: "missing" },
      },
    });
    const sentences = generateNarrative(result(), previous);
    expect(sentences).toContain("Total emissions rose from 0 to 30 tCO2e.");
  });
});
