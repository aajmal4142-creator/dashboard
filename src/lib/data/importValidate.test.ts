import { describe, expect, it } from "vitest";

import { dryRunImport, parseCsvToImportRows } from "./importValidate";

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

  it("detects changed values", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "electricity_kwh",
          value: 2000,
          quality: "measured",
          unit: "kWh",
        },
      ],
      existing,
      periodLocked: false,
    });
    expect(result.changed).toBe(1);
    expect(result.rows[0]?.kind).toBe("changed");
    expect(result.rows[0]?.before?.value).toBe(1000);
    expect(result.rows[0]?.after?.value).toBe(2000);
  });

  it("treats quality change as a change", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "electricity_kwh",
          value: 1000,
          quality: "calculated",
          unit: "kWh",
        },
      ],
      existing,
      periodLocked: false,
    });
    expect(result.changed).toBe(1);
  });

  it("accepts missing value with missing quality", () => {
    const result = dryRunImport({
      rows: [
        {
          metricKey: "diesel_litres",
          value: null,
          quality: "missing",
          unit: "L",
        },
      ],
      existing: [],
      periodLocked: false,
    });
    expect(result.added).toBe(1);
    expect(result.rows[0]?.kind).toBe("added");
  });
});

describe("parseCsvToImportRows", () => {
  it("parses simple CSV with headers", () => {
    const csv = `metricKey,value,quality,unit
electricity_kwh,1000,measured,kWh
gas_kwh,500,calculated,kWh`;
    const rows = parseCsvToImportRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.metricKey).toBe("electricity_kwh");
    expect(rows[0]?.value).toBe("1000");
    expect(rows[1]?.metricKey).toBe("gas_kwh");
  });

  it("handles quoted CSV values", () => {
    const csv = `metricKey,value,note
electricity_kwh,1000,"Has a, comma in it"
gas_kwh,500,"Multi-word, note here"`;
    const rows = parseCsvToImportRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.note).toContain("comma");
    expect(rows[1]?.note).toContain("Multi-word");
  });

  it("normalizes header names (snake_case, camelCase)", () => {
    const csv = `metric_key,evidence_ref,framework_cell
electricity_kwh,,scope-1`;
    const rows = parseCsvToImportRows(csv);
    expect(rows[0]?.metricKey).toBe("electricity_kwh");
    expect(rows[0]?.evidenceRef).toBe("");
    expect(rows[0]?.frameworkCell).toBe("scope-1");
  });

  it("ignores unknown header columns", () => {
    const csv = `metricKey,unknown_col,value
electricity_kwh,ignored,1000`;
    const rows = parseCsvToImportRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metricKey).toBe("electricity_kwh");
    expect(rows[0]?.value).toBe("1000");
    expect("unknown_col" in rows[0]!).toBe(false);
  });

  it("handles empty lines and trailing newlines", () => {
    const csv = `metricKey,value
electricity_kwh,1000

gas_kwh,500`;
    const rows = parseCsvToImportRows(csv);
    expect(rows).toHaveLength(2);
  });

  it("returns empty array for CSV with no data rows", () => {
    const csv = "metricKey,value";
    const rows = parseCsvToImportRows(csv);
    expect(rows).toHaveLength(0);
  });

  it("preserves whitespace inside quoted fields", () => {
    const csv = `metricKey,note
electricity_kwh,"  whitespace preserved  "`;
    const rows = parseCsvToImportRows(csv);
    expect(rows[0]?.note).toBe("  whitespace preserved  ");
  });

  it("handles numeric and string values uniformly", () => {
    const csv = `metricKey,value,label
electricity_kwh,1000,Electricity (kWh)
gas_kwh,,Natural Gas (kWh)`;
    const rows = parseCsvToImportRows(csv);
    expect(rows[0]?.value).toBe("1000");
    expect(rows[1]?.value).toBe("");
  });
});
