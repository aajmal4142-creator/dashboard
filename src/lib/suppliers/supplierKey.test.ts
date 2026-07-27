import { describe, expect, it } from "vitest";

import { DatapointUniqueIndex, NO_SUPPLIER_KEY, supplierKeyFrom } from "./supplierKey";

describe("supplierKey sentinel uniqueness", () => {
  it("maps missing supplier to empty-string sentinel, never null", () => {
    expect(NO_SUPPLIER_KEY).toBe("");
    expect(supplierKeyFrom(null)).toBe("");
    expect(supplierKeyFrom(undefined)).toBe("");
    expect(supplierKeyFrom("")).toBe("");
    expect(supplierKeyFrom("sup_abc")).toBe("sup_abc");
  });

  it("REJECTS two no-supplier rows for the same org/period/metric", () => {
    const index = new DatapointUniqueIndex();
    const base = {
      organisationId: "org1",
      periodId: "per1",
      metricKey: "supplier_spend_total",
      supplierKey: NO_SUPPLIER_KEY,
    };
    expect(index.tryInsert(base)).toEqual({ ok: true });
    expect(index.tryInsert(base)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("allows the same metric for different suppliers", () => {
    const index = new DatapointUniqueIndex();
    expect(
      index.tryInsert({
        organisationId: "org1",
        periodId: "per1",
        metricKey: "supplier_reported_tco2e",
        supplierKey: "sup_a",
      }),
    ).toEqual({ ok: true });
    expect(
      index.tryInsert({
        organisationId: "org1",
        periodId: "per1",
        metricKey: "supplier_reported_tco2e",
        supplierKey: "sup_b",
      }),
    ).toEqual({ ok: true });
  });

  it("allows one no-supplier row and one supplier-scoped row for same metric", () => {
    const index = new DatapointUniqueIndex();
    expect(
      index.tryInsert({
        organisationId: "org1",
        periodId: "per1",
        metricKey: "electricity_kwh",
        supplierKey: NO_SUPPLIER_KEY,
      }),
    ).toEqual({ ok: true });
    expect(
      index.tryInsert({
        organisationId: "org1",
        periodId: "per1",
        metricKey: "electricity_kwh",
        supplierKey: "sup_a",
      }),
    ).toEqual({ ok: true });
  });
});
