import { describe, expect, it } from "vitest";

import { applicableFrameworks } from "./applicable";
import { coverageFromData } from "./coverage";
import { disclosureCodeOf, type FrameworkMappingRow } from "./types";

describe("disclosureCode alias", () => {
  it("equals datapointRef", () => {
    const row: FrameworkMappingRow = {
      framework: "CSRD_SET1",
      datapointRef: "E1-5_01",
      label: "Total energy",
      required: true,
      contributionOnly: false,
      metricKeys: ["derived.energy_total_mwh"],
    };
    expect(disclosureCodeOf(row)).toBe("E1-5_01");
  });
});

describe("applicableFrameworks", () => {
  it("voluntary orgs get VSME + GRI only — not the CSRD wall", () => {
    expect(applicableFrameworks({ standardVersions: ["VSME"], voluntary: true })).toEqual(
      ["VSME", "GRI"],
    );
  });

  it("CSRD scope includes ISSB, GRI, and Taxonomy eligibility", () => {
    const apps = applicableFrameworks({
      standardVersions: ["CSRD_SET1"],
      voluntary: false,
    });
    expect(apps).toContain("CSRD_SET1");
    expect(apps).toContain("ISSB_S1");
    expect(apps).toContain("ISSB_S2");
    expect(apps).toContain("GRI");
    expect(apps).toContain("EU_TAXONOMY");
    expect(apps).not.toContain("BRSR");
  });

  it("BRSR includes GRI hook", () => {
    const apps = applicableFrameworks({
      standardVersions: ["BRSR"],
      voluntary: false,
    });
    expect(apps).toContain("BRSR");
    expect(apps).toContain("GRI");
  });
});

describe("coverageFromData — quality-aware", () => {
  const mappings: FrameworkMappingRow[] = [
    {
      framework: "CSRD_SET1",
      datapointRef: "E1-5_01",
      label: "Total energy",
      required: true,
      contributionOnly: false,
      metricKeys: ["derived.energy_total_mwh"],
    },
    {
      framework: "CSRD_SET1",
      datapointRef: "E1-5_11",
      label: "Petroleum",
      required: false,
      contributionOnly: true,
      metricKeys: ["diesel_litres"],
    },
    {
      framework: "ISSB_S2",
      datapointRef: "S2-energy",
      label: "ISSB energy",
      required: false,
      contributionOnly: true,
      metricKeys: ["electricity_kwh"],
    },
  ];

  it("never marks satisfied from mere presence when estimated", () => {
    const { disclosures } = coverageFromData({
      applicable: ["CSRD_SET1"],
      mappings,
      datapoints: [
        { metricKey: "electricity_kwh", quality: "estimated" },
        { metricKey: "diesel_litres", quality: "estimated" },
        { metricKey: "petrol_litres", quality: "estimated" },
        { metricKey: "natural_gas_m3", quality: "estimated" },
        { metricKey: "electricity_renewable_pct", quality: "estimated" },
        { metricKey: "district_heat_kwh", quality: "estimated" },
      ],
    });
    const total = disclosures.find((d) => d.disclosureCode === "E1-5_01");
    expect(total?.state).toBe("partial");
  });

  it("never marks satisfied from spend_estimate provenance", () => {
    const { disclosures } = coverageFromData({
      applicable: ["CSRD_SET1"],
      mappings,
      datapoints: [
        {
          metricKey: "diesel_litres",
          quality: "calculated",
          provenance: "spend_estimate",
        },
      ],
    });
    expect(disclosures.find((d) => d.disclosureCode === "E1-5_11")?.state).toBe(
      "partial",
    );
  });

  it("marks satisfied only for required + !contributionOnly + honest grade", () => {
    const { disclosures } = coverageFromData({
      applicable: ["CSRD_SET1"],
      mappings,
      datapoints: [
        { metricKey: "electricity_kwh", quality: "measured" },
        { metricKey: "diesel_litres", quality: "measured" },
        { metricKey: "petrol_litres", quality: "measured" },
        { metricKey: "natural_gas_m3", quality: "measured" },
        { metricKey: "electricity_renewable_pct", quality: "measured" },
        { metricKey: "district_heat_kwh", quality: "measured" },
      ],
    });
    expect(disclosures.find((d) => d.disclosureCode === "E1-5_01")?.state).toBe(
      "satisfied",
    );
    expect(disclosures.find((d) => d.disclosureCode === "E1-5_11")?.state).toBe(
      "contributes",
    );
  });

  it("gap when missing", () => {
    const { disclosures } = coverageFromData({
      applicable: ["CSRD_SET1", "ISSB_S2"],
      mappings,
      datapoints: [],
    });
    expect(disclosures.every((d) => d.state === "gap")).toBe(true);
  });

  it("voluntary applicable set excludes CSRD disclosures", () => {
    const { byFramework } = coverageFromData({
      applicable: ["VSME", "GRI"],
      datapoints: [{ metricKey: "electricity_kwh", quality: "measured" }],
    });
    expect(byFramework.every((f) => f.framework !== "CSRD_SET1")).toBe(true);
  });
});
