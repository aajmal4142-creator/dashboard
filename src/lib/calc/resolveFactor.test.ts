import { describe, expect, it } from "vitest";

import { resolveFactor } from "./resolveFactor";
import { FACTORS_FIXTURE } from "./__fixtures__/factors.fixture";

describe("resolveFactor", () => {
  it("step 1: returns the exact region + year match", () => {
    const factor = resolveFactor(FACTORS_FIXTURE, "grid_electricity", "GB", 2024);
    expect(factor.id).toBe("f-grid-gb-2024");
  });

  it("step 1: matches a factor with no validity window via publicationYear", () => {
    const factor = resolveFactor(FACTORS_FIXTURE, "business_travel_avg", "GB", 2024);
    expect(factor.id).toBe("f-travel-gb-2024");
  });

  it("falls through when a validity-windowed factor does not cover the requested year", () => {
    // GB grid electricity 2024 is only valid 2024-01-01..2024-12-31; 2025 has no exact match,
    // so this must fall back to step 2 (region + latest), not throw.
    const factor = resolveFactor(FACTORS_FIXTURE, "grid_electricity", "GB", 2025);
    expect(factor.id).toBe("f-grid-gb-2024");
  });

  it("step 2: falls back to the latest available year for the region when the exact year is absent", () => {
    // No GB grid electricity factor is valid for 2020; the latest GB row is 2024.
    const factor = resolveFactor(FACTORS_FIXTURE, "grid_electricity", "GB", 2020);
    expect(factor.id).toBe("f-grid-gb-2024");
  });

  it("step 2: prefers the higher publication year among multiple region matches", () => {
    const factor = resolveFactor(FACTORS_FIXTURE, "grid_electricity", "GB", 1999);
    expect(factor.publicationYear).toBe(2024);
  });

  it("step 3: falls back to GLOBAL + year when the region has no rows at all", () => {
    const factor = resolveFactor(FACTORS_FIXTURE, "diesel", "FR", 2024);
    expect(factor.id).toBe("f-diesel-global-2024");
  });

  it("throws when no region, no GLOBAL, and no fallback exists — never silently defaults", () => {
    expect(() => resolveFactor(FACTORS_FIXTURE, "coal", "FR", 2024)).toThrow(
      /no factor for key="coal" region="FR" year=2024/,
    );
  });

  it("throws when the key exists but neither the requested region nor GLOBAL carry it", () => {
    expect(() =>
      resolveFactor(FACTORS_FIXTURE, "spend_purchased_goods", "US", 2024),
    ).toThrow(Error);
  });

  it("step 2: keeps the existing latest when candidates arrive in descending year order", () => {
    const factors = [
      {
        id: "b-2024",
        key: "test_key",
        value: 1,
        unit: "u",
        source: "s",
        publicationYear: 2024,
        region: "XX",
      },
      {
        id: "a-2020",
        key: "test_key",
        value: 2,
        unit: "u",
        source: "s",
        publicationYear: 2020,
        region: "XX",
      },
    ];
    const factor = resolveFactor(factors, "test_key", "XX", 1999);
    expect(factor.id).toBe("b-2024");
  });

  it("coversYear: a validFrom-only window covers years up to the open (Infinity) end", () => {
    const factors = [
      {
        id: "vf-only",
        key: "vf_key",
        value: 1,
        unit: "u",
        source: "s",
        publicationYear: 2023,
        region: "YY",
        validFrom: "2023-01-01",
      },
    ];
    expect(resolveFactor(factors, "vf_key", "YY", 2099).id).toBe("vf-only");
  });

  it("coversYear: a validUntil-only window covers years back to the open (-Infinity) start", () => {
    const factors = [
      {
        id: "vu-only",
        key: "vu_key",
        value: 1,
        unit: "u",
        source: "s",
        publicationYear: 2023,
        region: "ZZ",
        validUntil: "2025-12-31",
      },
    ];
    expect(resolveFactor(factors, "vu_key", "ZZ", 1900).id).toBe("vu-only");
  });

  it("resolves correctly for each seeded region (GB, US, IN, EU)", () => {
    expect(resolveFactor(FACTORS_FIXTURE, "grid_electricity", "US", 2024).value).toBe(
      0.385,
    );
    expect(resolveFactor(FACTORS_FIXTURE, "grid_electricity", "IN", 2024).value).toBe(
      0.727,
    );
    expect(resolveFactor(FACTORS_FIXTURE, "grid_electricity", "EU", 2024).value).toBe(
      0.251,
    );
  });
});
