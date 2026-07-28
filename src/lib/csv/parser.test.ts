import { describe, it, expect } from "vitest";
import { parseCSV, validateDatapoints, type ParsedDatapoint } from "./parser";

describe("CSV Parser - Format Detection", () => {
  it("parses CSRD format CSV", () => {
    const csv = `metric_key,value,unit,quality,csrd_cell
electricity_kwh,1000,kWh,measured,scope-1
gas_kwh,500,kWh,calculated,scope-1`;
    const result = parseCSV(csv, "csrd");
    expect(result.datapoints).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.datapoints[0]?.metricKey).toBe("electricity_kwh");
  });

  it("parses BRSR format CSV", () => {
    const csv = `metric_key,value,unit,quality,principle_cell
energy_used,1000,kWh,measured,principle-4
waste_generated,500,kg,calculated,principle-5`;
    const result = parseCSV(csv, "brsr");
    expect(result.datapoints).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("auto-detects CSRD format from headers", () => {
    const csv = `metric_key,value,unit,quality,csrd_cell
electricity_kwh,1000,kWh,measured,scope-1`;
    const result = parseCSV(csv, "auto");
    expect(result.datapoints).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("auto-detects BRSR format from headers", () => {
    const csv = `metric_key,value,unit,quality,principle_cell
energy_used,1000,kWh,measured,principle-4`;
    const result = parseCSV(csv, "auto");
    expect(result.datapoints).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe("CSV Parser - Header Normalization", () => {
  it("handles snake_case headers", () => {
    const csv = `metric_key,metric_value,measurement_unit,data_quality
electricity_kwh,1000,kWh,measured`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
  });

  it("handles mixed case headers", () => {
    const csv = `MetricKey,Value,Unit,Quality
electricity_kwh,1000,kWh,measured`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
  });

  it("ignores unknown columns", () => {
    const csv = `metric_key,value,unit,quality,unknown_col
electricity_kwh,1000,kWh,measured,ignored`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
    expect(result.datapoints[0]?.metricKey).toBe("electricity_kwh");
  });
});

describe("CSV Parser - Value Parsing", () => {
  it("parses numeric values", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000.5,kWh,measured
gas_kwh,-500,kWh,calculated`;
    const result = parseCSV(csv);
    expect(result.datapoints[0]?.value).toBe(1000.5);
    expect(result.datapoints[1]?.value).toBe(-500);
  });

  it("handles empty values as null", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,,kWh,missing`;
    const result = parseCSV(csv);
    expect(result.datapoints[0]?.value).toBeNull();
  });

  it("parses non-numeric values as null (validation layer catches errors)", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,not_a_number,kWh,measured`;
    const result = parseCSV(csv);
    // CSV parser just parses - validation layer checks for NaN
    expect(result.datapoints[0]?.value).toBeNull();
  });

  it("handles scientific notation", () => {
    const csv = `metric_key,value,unit,quality
emissions_tco2e,1.5e6,tCO2e,calculated`;
    const result = parseCSV(csv);
    expect(result.datapoints[0]?.value).toBe(1500000);
  });
});

describe("CSV Parser - Quality Validation", () => {
  it("accepts valid quality values", () => {
    const csv = `metric_key,value,unit,quality
test_metric_1,1000,kWh,measured
test_metric_2,500,kWh,calculated
test_metric_3,100,m3,estimated
test_metric_4,,kg,missing`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
    expect(result.datapoints[0]?.quality).toBe("measured");
    expect(result.datapoints[1]?.quality).toBe("calculated");
    expect(result.datapoints[2]?.quality).toBe("estimated");
    expect(result.datapoints[3]?.quality).toBe("missing");
  });

  it("maps quality variations", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,metered
gas_kwh,500,kWh,derived
water_m3,100,m3,assumed`;
    const result = parseCSV(csv);
    expect(result.datapoints[0]?.quality).toBe("measured");
    expect(result.datapoints[1]?.quality).toBe("calculated");
    expect(result.datapoints[2]?.quality).toBe("estimated");
  });

  it("rejects invalid quality values", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,invalid`;
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toMatch(/quality must be one of/);
  });

  it("validates missing quality must have empty value during parse", () => {
    const csv = `metric_key,value,unit,quality
test_metric_1,1000,kWh,missing`;
    const result = parseCSV(csv);
    // The CSV parser validates and rejects rows with missing quality but a value
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts missing quality with empty value", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,,kWh,missing`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe("CSV Parser - Required Fields", () => {
  it("requires metric_key column", () => {
    const csv = `value,unit,quality
1000,kWh,measured`;
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toMatch(/Could not find metric key column/);
  });

  it("rejects rows with missing metric_key", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,measured
,500,kWh,calculated`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toMatch(/metricKey is required/);
  });

  it("requires quality field", () => {
    const csv = `metric_key,value,unit
electricity_kwh,1000,kWh`;
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toMatch(/quality must be one of/);
  });
});

describe("CSV Parser - Error Reporting", () => {
  it("includes line numbers in errors", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,measured
gas_kwh,500,kWh,badquality
water_m3,,m3,missing`;
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.lineNumber).toBe(3);
  });

  it("provides detailed error messages for invalid quality", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,badquality`;
    const result = parseCSV(csv);
    expect(result.errors[0]).toMatchObject({
      lineNumber: 2,
      field: "quality",
      message: expect.stringContaining("quality must be one of"),
    });
  });

  it("reports summary statistics", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,measured
gas_kwh,500,kWh,badquality`;
    const result = parseCSV(csv);
    expect(result.summary).toMatchObject({
      totalLines: 3,
      successCount: 1,
      errorCount: 1,
    });
  });
});

describe("CSV Parser - Quoted Fields", () => {
  it("handles quoted CSV values with commas", () => {
    const csv = `metric_key,value,unit,quality,note
test_metric,1000,kWh,measured,"Note with, comma"`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
    expect(result.datapoints[0]?.note).toContain("comma");
  });

  it("preserves content in quoted fields", () => {
    const csv = `metric_key,value,unit,quality,note
test_metric,1000,kWh,measured,"preserves spaces"`;
    const result = parseCSV(csv);
    expect(result.datapoints[0]?.note).toBeDefined();
    expect(result.datapoints[0]?.note).toContain("preserves");
  });
});

describe("CSV Parser - Datapoint Validation", () => {
  it("detects duplicate metrics", () => {
    const datapoints: ParsedDatapoint[] = [
      {
        metricKey: "electricity_kwh",
        value: 1000,
        unit: "kWh",
        quality: "measured",
        lineNumber: 2,
      },
      {
        metricKey: "electricity_kwh",
        value: 2000,
        unit: "kWh",
        quality: "measured",
        lineNumber: 3,
      },
    ];
    const errors = validateDatapoints(datapoints);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/Duplicate metric key/);
  });

  it("rejects negative values", () => {
    const datapoints: ParsedDatapoint[] = [
      {
        metricKey: "electricity_kwh",
        value: -1000,
        unit: "kWh",
        quality: "measured",
        lineNumber: 2,
      },
    ];
    const errors = validateDatapoints(datapoints);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/Negative values/);
  });

  it("rejects unreasonably large values", () => {
    const datapoints: ParsedDatapoint[] = [
      {
        metricKey: "emissions_tco2e",
        value: 1e16,
        unit: "tCO2e",
        quality: "calculated",
        lineNumber: 2,
      },
    ];
    const errors = validateDatapoints(datapoints);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/exceeds reasonable bounds/);
  });

  it("accepts valid datapoints", () => {
    const datapoints: ParsedDatapoint[] = [
      {
        metricKey: "electricity_kwh",
        value: 1000,
        unit: "kWh",
        quality: "measured",
        lineNumber: 2,
      },
      {
        metricKey: "gas_kwh",
        value: null,
        unit: "kWh",
        quality: "missing",
        lineNumber: 3,
      },
    ];
    const errors = validateDatapoints(datapoints);
    expect(errors).toHaveLength(0);
  });
});

describe("CSV Parser - Edge Cases", () => {
  it("handles empty CSV", () => {
    const csv = "";
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.datapoints).toHaveLength(0);
  });

  it("handles CSV with only headers", () => {
    const csv = "metric_key,value,unit,quality";
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.datapoints).toHaveLength(0);
  });

  it("handles blank lines", () => {
    const csv = `metric_key,value,unit,quality
electricity_kwh,1000,kWh,measured

gas_kwh,500,kWh,calculated`;
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const csv = "metric_key,value,unit,quality\r\nelectricity_kwh,1000,kWh,measured";
    const result = parseCSV(csv);
    expect(result.datapoints).toHaveLength(1);
  });

  it("trims whitespace from cells", () => {
    const csv = `metric_key , value , unit , quality
  electricity_kwh  ,  1000  ,  kWh  ,  measured  `;
    const result = parseCSV(csv);
    expect(result.datapoints[0]?.metricKey).toBe("electricity_kwh");
    expect(result.datapoints[0]?.value).toBe(1000);
  });
});
