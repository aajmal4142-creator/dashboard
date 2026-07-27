import { describe, expect, it } from "vitest";

import { DATA_METRICS } from "@/lib/data/metrics";

import { REQUIRED_RUNWAY_METRICS, rankGaps } from "./gaps";
import { plainGapCopy } from "./plainGaps";

const DATA_KEYS = new Set(DATA_METRICS.map((m) => m.key));
/** Supplier Scope 3 is collected via suppliers, not the data grid. */
const ALLOWED_EXTERNAL = new Set(["supplier_reported_tco2e"]);

describe("REQUIRED_RUNWAY_METRICS", () => {
  it("uses canonical metric keys that exist in DATA_METRICS (or supplier flow)", () => {
    for (const m of REQUIRED_RUNWAY_METRICS) {
      const ok = DATA_KEYS.has(m.metricKey) || ALLOWED_EXTERNAL.has(m.metricKey);
      expect(ok, `unknown runway key: ${m.metricKey}`).toBe(true);
    }
  });

  it("has plain copy for every runway metric", () => {
    for (const m of REQUIRED_RUNWAY_METRICS) {
      const copy = plainGapCopy(m.metricKey, m.label);
      expect(copy.action.length).toBeGreaterThan(0);
      expect(copy.need).not.toContain(`Still missing: ${m.label}`);
    }
  });

  it("counts natural_gas_m3 as collected when present", () => {
    const present = new Set(["electricity_kwh", "natural_gas_m3", "diesel_litres"]);
    const gaps = rankGaps(present);
    expect(gaps.missing.some((g) => g.metricKey === "natural_gas_m3")).toBe(false);
    expect(gaps.collected).toBe(3);
  });
});
