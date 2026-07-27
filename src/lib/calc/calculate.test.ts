import { describe, expect, it } from "vitest";

import { calculate } from "./calculate";
import { computeScope1, computeScope2, computeScope3 } from "./emissions";
import { CALC_FACTORS, CALC_FIXTURES } from "./__fixtures__/cases.fixture";
import { FACTORS_FIXTURE } from "./__fixtures__/factors.fixture";
import type { DatapointValue } from "./types";

describe("calculate — golden fixtures", () => {
  for (const fixture of CALC_FIXTURES) {
    it(`matches the frozen golden output for "${fixture.name}" (${fixture.description})`, () => {
      const result = calculate(fixture.input, CALC_FACTORS);
      expect(result).toEqual(fixture.expected);
    });
  }

  it("covers all 12 required scenarios", () => {
    expect(CALC_FIXTURES).toHaveLength(12);
    const names = new Set(CALC_FIXTURES.map((f) => f.name));
    expect(names.size).toBe(12);
  });
});

describe("calculate — edge cases beyond the golden fixtures", () => {
  it("returns an honestly empty result when no metrics are supplied at all", () => {
    const result = calculate(
      { metrics: {}, context: { region: "GB", year: 2024 } },
      CALC_FACTORS,
    );
    expect(result.dataQualityPct).toBe(0);
    expect(result.emissions.scope1.quality).toBe("missing");
    expect(result.emissions.scope2.quality).toBe("missing");
    expect(result.emissions.scope3.quality).toBe("missing");
    expect(result.emissions.total.quality).toBe("missing");
    expect(result.factorsUsed).toEqual([]);
    // No emissions data and no employees/renewable override → E defaults to 100, not a false "improvement".
    expect(result.scores.e).toBe(100);
  });

  it("throws rather than silently defaulting when a present metric has no resolvable factor", () => {
    const input = {
      context: { region: "ZZ", year: 2024 },
      metrics: {
        diesel_litres: { value: 100, quality: "measured" as const },
      },
    };
    // "ZZ" has no diesel factor and there is no GLOBAL diesel row reachable for it either
    // once we strip the GLOBAL fixture row out.
    const factorsWithoutGlobalDiesel = FACTORS_FIXTURE.filter(
      (f) => f.id !== "f-diesel-global-2024",
    );
    expect(() => calculate(input, factorsWithoutGlobalDiesel)).toThrow(
      /no factor for key="diesel"/,
    );
  });

  it("de-duplicates factorsUsed when two components resolve to the same factor id", () => {
    const dupFactors = [
      {
        id: "dup-1",
        key: "diesel",
        value: 2,
        unit: "kgCO2e/L",
        source: "TEST",
        publicationYear: 2024,
        region: "GB",
      },
      {
        id: "dup-1",
        key: "natural_gas",
        value: 3,
        unit: "kgCO2e/m3",
        source: "TEST",
        publicationYear: 2024,
        region: "GB",
      },
    ];
    const result = calculate(
      {
        context: { region: "GB", year: 2024 },
        metrics: {
          diesel_litres: { value: 10, quality: "measured" },
          natural_gas_m3: { value: 5, quality: "measured" },
        },
      },
      dupFactors,
    );
    expect(result.factorsUsed).toHaveLength(1);
    expect(result.factorsUsed[0].factorId).toBe("dup-1");
  });

  it("falls back to context.employees and context.renewablePct when the metrics are absent", () => {
    const result = calculate(
      {
        context: { region: "GB", year: 2024, employees: 10, renewablePct: 50 },
        metrics: {
          electricity_kwh: { value: 10_000, quality: "measured" },
        },
      },
      CALC_FACTORS,
    );
    // carbonPerEmployee = 2.07 tCO2e / 10 employees = 0.207 < 1 → no penalty; renewable bonus = 50 × 0.15 = 7.5
    expect(result.scores.e).toBeCloseTo(100, 5);
  });
});

describe("emissions — direct scope computations not exercised by every fixture", () => {
  const missingAll: Record<string, DatapointValue> = {};

  it("computeScope1 is fully missing with no inputs at all", () => {
    const scope = computeScope1(missingAll, FACTORS_FIXTURE, "GB", 2024);
    expect(scope.measured).toEqual({ value: 0, unit: "tCO2e", quality: "missing" });
    expect(scope.missingInputs).toEqual([
      "diesel_litres",
      "natural_gas_m3",
      "petrol_litres",
    ]);
  });

  it("computeScope2 is fully missing with no electricity input", () => {
    const scope = computeScope2(missingAll, FACTORS_FIXTURE, "GB", 2024);
    expect(scope.measured).toEqual({ value: 0, unit: "tCO2e", quality: "missing" });
    expect(scope.missingInputs).toEqual(["electricity_kwh"]);
  });

  it("computeScope3 is fully missing with no spend or travel input", () => {
    const scope = computeScope3(missingAll, FACTORS_FIXTURE, "GB", 2024);
    expect(scope.measured).toEqual({ value: 0, unit: "tCO2e", quality: "missing" });
    expect(scope.missingInputs).toEqual(["supplier_spend_total", "business_travel_km"]);
  });

  it("adds direct supplier-reported tCO2e without applying an emission factor", () => {
    const scope = computeScope3(
      {
        supplier_reported_tco2e: { value: 12.5, quality: "measured", unit: "tCO2e" },
      },
      FACTORS_FIXTURE,
      "GB",
      2024,
    );
    expect(scope.components.some((c) => c.key === "supplier_reported")).toBe(true);
    expect(scope.measured.value).toBe(12.5);
    expect(scope.measured.quality).toBe("calculated");
  });

  it("computeScope1 pins the single factorId when only one component is present", () => {
    const scope = computeScope1(
      { diesel_litres: { value: 100, quality: "measured" } },
      FACTORS_FIXTURE,
      "GB",
      2024,
    );
    expect(scope.measured.factorId).toBe("f-diesel-gb-2024");
  });

  it("computeScope1 leaves factorId undefined when multiple components combine", () => {
    const scope = computeScope1(
      {
        diesel_litres: { value: 100, quality: "measured" },
        natural_gas_m3: { value: 50, quality: "measured" },
      },
      FACTORS_FIXTURE,
      "GB",
      2024,
    );
    expect(scope.measured.factorId).toBeUndefined();
  });
});
