import { describe, expect, it } from "vitest";

import { composeScope3Contributions } from "./composition";

describe("composeScope3Contributions", () => {
  it("sums primary and estimate without double-counting the same supplier", () => {
    const result = composeScope3Contributions(
      [
        {
          supplierId: "a",
          provenance: "supplier_primary",
          quality: "calculated",
          value: 10,
        },
        {
          supplierId: "a",
          provenance: "spend_estimate",
          quality: "estimated",
          value: 50,
        },
        {
          supplierId: "b",
          provenance: "spend_estimate",
          quality: "estimated",
          value: 20,
        },
      ],
      ["a", "b", "c"],
    );
    expect(result.primaryTco2e).toBe(10);
    expect(result.estimateTco2e).toBe(20);
    expect(result.totalTco2e).toBe(30);
    expect(result.primarySharePct).toBe(33.3);
    expect(result.gapSupplierIds).toEqual(["c"]);
  });

  it("treats missing quality as gap, never as zero contribution", () => {
    const result = composeScope3Contributions(
      [
        {
          supplierId: "a",
          provenance: "spend_estimate",
          quality: "missing",
          value: 99,
        },
      ],
      ["a"],
    );
    expect(result.totalTco2e).toBe(0);
    expect(result.gapSupplierIds).toEqual(["a"]);
  });

  it("reports 100% supplier-verified when only primary rows exist", () => {
    const result = composeScope3Contributions([
      {
        supplierId: "a",
        provenance: "supplier_primary",
        quality: "calculated",
        value: 5,
      },
    ]);
    expect(result.primarySharePct).toBe(100);
    expect(result.estimateTco2e).toBe(0);
  });
});
