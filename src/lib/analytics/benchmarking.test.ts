import { describe, it, expect } from "vitest";
import { getBenchmarkStatus, getBenchmarkInsights } from "./benchmarking";

describe("benchmarking", () => {
  describe("getBenchmarkStatus", () => {
    it("returns best_in_class for percentile >= 90", () => {
      expect(getBenchmarkStatus(92)).toBe("best_in_class");
      expect(getBenchmarkStatus(90)).toBe("best_in_class");
    });

    it("returns above_median for 65-89", () => {
      expect(getBenchmarkStatus(75)).toBe("above_median");
      expect(getBenchmarkStatus(65)).toBe("above_median");
    });

    it("returns at_median for 35-64", () => {
      expect(getBenchmarkStatus(50)).toBe("at_median");
      expect(getBenchmarkStatus(35)).toBe("at_median");
    });

    it("returns below_median for < 35", () => {
      expect(getBenchmarkStatus(20)).toBe("below_median");
      expect(getBenchmarkStatus(0)).toBe("below_median");
    });

    it("returns at_median for undefined", () => {
      expect(getBenchmarkStatus(undefined)).toBe("at_median");
    });
  });

  describe("getBenchmarkInsights", () => {
    it("provides insights for best_in_class status", () => {
      const insights = getBenchmarkInsights("best_in_class");
      expect(insights.length).toBe(3);
      expect(insights[0]).toContain("90%");
    });

    it("provides insights for above_median status", () => {
      const insights = getBenchmarkInsights("above_median");
      expect(insights.length).toBe(3);
      expect(insights[0]).toContain("top quartile");
    });

    it("provides insights for at_median status", () => {
      const insights = getBenchmarkInsights("at_median");
      expect(insights.length).toBe(3);
      expect(insights[0]).toContain("median");
    });

    it("provides insights for below_median status", () => {
      const insights = getBenchmarkInsights("below_median");
      expect(insights.length).toBe(3);
      expect(insights[0]).toContain("Opportunity");
    });
  });
});
