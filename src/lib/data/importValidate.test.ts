import { describe, expect, it } from "vitest";

import { dryRunImport } from "./importValidate";

describe("dryRunImport", () => {
  const existing = [
    {
      metricKey: "electricity_kwh",
      value: 1000,
      unit: "kWh",
      quality: "measured" as const,
    },
  ];

  it("rejects unknown metric keys", () => {
    const result = dryRunImport({
      rows: [{ metricKey: "nope", value: 1, quality: "measured", unit: "kWh" }],
      existing,
      periodLocked: false,
    });
    expect(result.rejected).toBe(1);
    expect(result.rows[0]?.reason).toMatch(/Unknown/);
  });

  it("rejects bad units", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "electricity_kwh",
          value: 1,
          quality: "measured",
          unit: "MWh",
        },
      ],
      existing,
      periodLocked: false,
    });
    expect(result.rejected).toBe(1);
  });

  it("marks lossless smart re-upload as unchanged", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "electricity_kwh",
          value: 1000,
          quality: "measured",
          unit: "kWh",
        },
      ],
      existing,
      periodLocked: false,
    });
    expect(result.unchanged).toBe(1);
    expect(result.changed).toBe(0);
  });

  it("refuses all rows when period locked", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "electricity_kwh",
          value: 2,
          quality: "measured",
          unit: "kWh",
        },
      ],
      existing,
      periodLocked: true,
    });
    expect(result.periodLocked).toBe(true);
    expect(result.rejected).toBe(1);
  });

  it("rejects missing quality with a value", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "diesel_litres",
          value: 0,
          quality: "missing",
          unit: "L",
        },
      ],
      existing: [],
      periodLocked: false,
    });
    expect(result.rejected).toBe(1);
  });
});
