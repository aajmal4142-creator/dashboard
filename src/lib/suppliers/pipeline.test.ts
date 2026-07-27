/**
 * Pipeline unit tests: primary quality, spend estimate, supersession composition,
 * missing≠zero (covered in composition.test), factor pin shape.
 */

import { describe, expect, it } from "vitest";

import { computeScope3 } from "@/lib/calc/emissions";
import { FACTORS_FIXTURE } from "@/lib/calc/__fixtures__/factors.fixture";
import { composeScope3Contributions } from "./composition";
import { metricsAndCompositionFromDatapoints } from "./metricsFromDatapoints";

describe("Scope 3 provenance pipeline", () => {
  it("supplier primary uses calculated quality semantics in composition feed", () => {
    const { metrics, composition } = metricsAndCompositionFromDatapoints([
      {
        id: "1",
        metricKey: "supplier_reported_tco2e",
        value: 12,
        quality: "calculated",
        provenance: "supplier_primary",
        supplierKey: "sup_a",
      },
    ]);
    expect(composition.primaryTco2e).toBe(12);
    expect(composition.estimateTco2e).toBe(0);
    expect(metrics.supplier_reported_tco2e?.quality).toBe("calculated");
    expect(metrics.supplier_reported_tco2e?.value).toBe(12);
  });

  it("spend estimate is estimated, not measured, and rolls into estimate metric", () => {
    const { metrics, composition } = metricsAndCompositionFromDatapoints([
      {
        id: "2",
        metricKey: "supplier_spend_estimate_tco2e",
        value: 40,
        quality: "estimated",
        provenance: "spend_estimate",
        supplierKey: "sup_b",
        factorId: "factor_spend_1",
      },
    ]);
    expect(composition.estimateTco2e).toBe(40);
    expect(composition.primarySharePct).toBe(0);
    expect(metrics.supplier_spend_estimate_tco2e?.quality).toBe("estimated");
    expect(metrics.supplier_spend_total).toBeUndefined();
  });

  it("late primary supersedes estimate — no double-count in composition or calc", () => {
    const composition = composeScope3Contributions([
      {
        supplierId: "sup_a",
        provenance: "supplier_primary",
        quality: "calculated",
        value: 10,
      },
      {
        supplierId: "sup_a",
        provenance: "spend_estimate",
        quality: "estimated",
        value: 100,
      },
    ]);
    expect(composition.totalTco2e).toBe(10);

    const { metrics } = metricsAndCompositionFromDatapoints([
      {
        id: "1",
        metricKey: "supplier_reported_tco2e",
        value: 10,
        quality: "calculated",
        provenance: "supplier_primary",
        supplierKey: "sup_a",
      },
      {
        id: "2",
        metricKey: "supplier_spend_estimate_tco2e",
        value: 100,
        quality: "missing",
        provenance: "spend_estimate",
        supplierKey: "sup_a",
      },
    ]);
    const scope = computeScope3(metrics, FACTORS_FIXTURE, "GB", 2024);
    const spendComp = scope.components.find((c) => c.key.startsWith("supplier_spend"));
    const reported = scope.components.find((c) => c.key === "supplier_reported");
    expect(reported?.valueTco2e).toBe(10);
    expect(spendComp).toBeUndefined();
  });

  it("unaddressed suppliers remain gaps (missing ≠ zero)", () => {
    const result = composeScope3Contributions([], ["sup_gap"]);
    expect(result.totalTco2e).toBe(0);
    expect(result.gapSupplierIds).toEqual(["sup_gap"]);
  });
});
