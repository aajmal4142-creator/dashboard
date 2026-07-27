import { describe, expect, it } from "vitest";

import {
  buildMatrixSnapshot,
  financialScoreOf,
  impactScoreOf,
  isMaterial,
  materialityNarrative,
} from "./score";

describe("materiality scores", () => {
  it("averages impact dimensions", () => {
    expect(impactScoreOf({ severity: 5, scope: 4, irremediability: 3 })).toBe(4);
  });

  it("averages financial dimensions", () => {
    expect(financialScoreOf({ magnitude: 4, likelihood: 2 })).toBe(3);
  });

  it("flags material when either axis clears threshold", () => {
    expect(isMaterial(3, 1)).toBe(true);
    expect(isMaterial(1, 3)).toBe(true);
    expect(isMaterial(2, 2)).toBe(false);
  });

  it("builds snapshot and narrative", () => {
    const snap = buildMatrixSnapshot([
      { esrsTopic: "E1", impactScore: 4, financialScore: 3 },
      { esrsTopic: "G1", impactScore: 1, financialScore: 1 },
    ]);
    expect(snap.materialCount).toBe(1);
    const text = materialityNarrative("Acme", snap.points, "Ada");
    expect(text).toContain("E1");
    expect(text).toContain("Ada");
  });
});
