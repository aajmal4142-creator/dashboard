import { describe, expect, it } from "vitest";

import { computeCohortStats, MIN_COHORT_SIZE, percentileRank } from "./stats";

describe("benchmark stats", () => {
  it("refuses cohorts below minimum", () => {
    expect(computeCohortStats([1, 2, 3, 4, 5, 6, 7])).toBeNull();
    expect(MIN_COHORT_SIZE).toBe(8);
  });

  it("computes quartiles for n>=8", () => {
    const s = computeCohortStats([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s?.cohortSize).toBe(8);
    expect(s?.p50).toBeGreaterThan(0);
  });

  it("ranks a value", () => {
    expect(percentileRank([1, 2, 3, 4, 5, 6, 7, 8], 5)).toBe(50);
  });
});
