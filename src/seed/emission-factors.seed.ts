import type { EmissionsStandard } from "@/lib/factors/standards";

export type EmissionFactorSeed = {
  key: string;
  label: string;
  value: number;
  unit: string;
  scope: "1" | "2" | "3";
  source:
    "DEFRA" | "EPA" | "CEA_India" | "EEA" | "NationalInventory" | "GHGProtocol" | "IPCC";
  /** Methodology family — org selector filters on this. */
  standard: EmissionsStandard;
  sourceUrl: string;
  publicationYear: number;
  region: string;
  validFrom: string;
  validUntil?: string;
  uncertaintyPct?: number;
  licence: string;
  attributionText: string;
};

const DEFRA_URL =
  "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024";
const GHG_2004_URL = "https://ghgprotocol.org/corporate-standard";
const IPCC_URL = "https://www.ipcc-nggip.iges.or.jp/public/2006gl/";

/**
 * Open / redistributable factors only.
 * SKIPPED: IEA — licensed, not redistributable (§11).
 * EU grid: EEA / national inventory proxies, not IEA.
 *
 * Values are published / illustrative figures from the cited sources for seed realism.
 * Calc engine must resolve by key/region/year/standard — never hardcode these in lib/calc.
 *
 * Existing DEFRA / regional rows are tagged, not deleted. GHG Protocol 2004 and IPCC
 * rows are added as parallel registry entries for org standard selection.
 */
export const emissionFactors: EmissionFactorSeed[] = [
  // —— Existing DEFRA / regional (tagged, retained) ——
  {
    key: "grid_electricity",
    label: "UK grid electricity (generation)",
    value: 0.207,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 5,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA Greenhouse gas reporting: conversion factors 2024.",
  },
  {
    key: "diesel",
    label: "Diesel (average biofuel blend)",
    value: 2.51233,
    unit: "kgCO2e/L",
    scope: "1",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 5,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA Greenhouse gas reporting: conversion factors 2024.",
  },
  {
    key: "natural_gas",
    label: "Natural gas",
    value: 2.04572,
    unit: "kgCO2e/m³",
    scope: "1",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 5,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA Greenhouse gas reporting: conversion factors 2024.",
  },
  {
    key: "petrol",
    label: "Petrol (average biofuel blend)",
    value: 2.0844,
    unit: "kgCO2e/L",
    scope: "1",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 5,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA Greenhouse gas reporting: conversion factors 2024.",
  },
  {
    key: "grid_electricity",
    label: "US eGRID subregion average (CONUS proxy)",
    value: 0.385,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "EPA",
    standard: "GHGProtocol2004",
    sourceUrl: "https://www.epa.gov/egrid/download-data",
    publicationYear: 2024,
    region: "US",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 10,
    licence: "US Government work (public domain)",
    attributionText:
      "Source: U.S. Environmental Protection Agency, eGRID. U.S. government works are generally public domain. Tagged GHG Protocol 2004 for corporate inventory use.",
  },
  {
    key: "grid_electricity",
    label: "India grid (CEA weighted average)",
    value: 0.727,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "CEA_India",
    standard: "GHGProtocol2004",
    sourceUrl: "https://cea.nic.in/coal-power-stations/?lang=en",
    publicationYear: 2024,
    region: "IN",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 15,
    licence: "Government of India — public statistical release",
    attributionText:
      "Source: Central Electricity Authority (CEA), Government of India. Grid emission factor from published CEA CO₂ baseline data.",
  },
  {
    key: "grid_electricity",
    label: "EU-27 electricity (EEA approximation)",
    value: 0.251,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "EEA",
    standard: "GHGProtocol2004",
    sourceUrl:
      "https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1",
    publicationYear: 2024,
    region: "EU",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 15,
    licence: "EEA standard re-use (CC BY 4.0 typically)",
    attributionText:
      "Source: European Environment Agency. Greenhouse gas emission intensity of electricity generation. Re-use per EEA terms; IEA figures deliberately excluded.",
  },
  {
    key: "spend_purchased_goods",
    label: "Spend-based purchased goods (DEFRA proxy)",
    value: 0.45,
    unit: "kgCO2e/GBP",
    scope: "3",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: "https://www.gov.uk/government/statistics/uks-carbon-footprint",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 30,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Spend-based factor derived from UK carbon footprint statistics for seed use.",
  },
  {
    key: "business_travel_avg",
    label: "Business travel average (land + short-haul mix)",
    value: 0.17,
    unit: "kgCO2e/km",
    scope: "3",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 15,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA conversion factors 2024.",
  },
  // residual_mix — market-based Scope 2 unmatched kWh (GHG Protocol Scope 2 Guidance).
  // Demo / seed value: higher than location grid because claimed renewables are removed.
  // Source: illustrative residual proxy for seed; replace with AIB/supplier residual for filings.
  {
    key: "residual_mix",
    label: "UK residual mix electricity (seed proxy)",
    value: 0.35,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    uncertaintyPct: 20,
    licence: "OGL v3.0 / seed proxy — not a published residual-mix table",
    attributionText:
      "Seed residual-mix factor for market-based Scope 2 unmatched kWh. Illustrative GB proxy (~0.35 kgCO2e/kWh); not a licensed AIB residual-mix figure. Replace before assurance filings.",
  },
  {
    key: "residual_mix",
    label: "Residual mix electricity (DEFRA GLOBAL seed proxy)",
    value: 0.4,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GLOBAL",
    validFrom: "2024-01-01",
    uncertaintyPct: 25,
    licence: "OGL v3.0 / seed proxy — not a published residual-mix table",
    attributionText:
      "Seed GLOBAL residual-mix fallback for DEFRA-standard inventories when a regional residual is absent. Illustrative only.",
  },
  {
    key: "district_heat",
    label: "District heat and steam",
    value: 0.17965,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "DEFRA",
    standard: "DEFRA",
    sourceUrl: DEFRA_URL,
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    uncertaintyPct: 10,
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA Greenhouse gas reporting: conversion factors 2024 — Heat and steam > District heat and steam.",
  },

  // —— GHG Protocol Corporate Standard (2004) — GLOBAL core ——
  {
    key: "grid_electricity",
    label: "Grid electricity (GHG Protocol 2004 GLOBAL proxy)",
    value: 0.5,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 20,
    licence: "GHG Protocol — free use with attribution",
    attributionText:
      "Derived for seed use from GHG Protocol Corporate Accounting and Reporting Standard (Revised Edition, 2004) guidance on Scope 2. Prefer regional grid factors when available.",
  },
  {
    key: "diesel",
    label: "Diesel (GHG Protocol 2004)",
    value: 2.68,
    unit: "kgCO2e/L",
    scope: "1",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 10,
    licence: "GHG Protocol — free use with attribution",
    attributionText:
      "Illustrative stationary/mobile combustion factor aligned with GHG Protocol Corporate Standard (2004) Scope 1 guidance. Cite original source tables in production filings.",
  },
  {
    key: "natural_gas",
    label: "Natural gas (GHG Protocol 2004)",
    value: 2.02,
    unit: "kgCO2e/m³",
    scope: "1",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 10,
    licence: "GHG Protocol — free use with attribution",
    attributionText:
      "Illustrative combustion factor aligned with GHG Protocol Corporate Standard (2004) Scope 1 guidance.",
  },
  {
    key: "petrol",
    label: "Petrol / gasoline (GHG Protocol 2004)",
    value: 2.31,
    unit: "kgCO2e/L",
    scope: "1",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 10,
    licence: "GHG Protocol — free use with attribution",
    attributionText:
      "Illustrative mobile combustion factor aligned with GHG Protocol Corporate Standard (2004) Scope 1 guidance.",
  },
  {
    key: "spend_purchased_goods",
    label: "Spend-based purchased goods (GHG Protocol 2004 proxy)",
    value: 0.4,
    unit: "kgCO2e/GBP",
    scope: "3",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 40,
    licence: "GHG Protocol — free use with attribution",
    attributionText:
      "Seed spend-based Scope 3 proxy for GHG Protocol Corporate Standard (2004) inventories. Prefer supplier-specific factors when available.",
  },
  {
    key: "business_travel_avg",
    label: "Business travel average (GHG Protocol 2004)",
    value: 0.15,
    unit: "kgCO2e/km",
    scope: "3",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 25,
    licence: "GHG Protocol — free use with attribution",
    attributionText:
      "Seed Scope 3 business-travel average under GHG Protocol Corporate Standard (2004).",
  },
  // residual_mix — GLOBAL seed for GHG Protocol 2004 inventories (demo Non-paid value).
  {
    key: "residual_mix",
    label: "Residual mix electricity (GHG Protocol 2004 seed)",
    value: 0.55,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 25,
    licence: "GHG Protocol — free use with attribution / seed proxy",
    attributionText:
      "Seed residual-mix factor for market-based Scope 2 unmatched kWh under GHG Protocol Corporate Standard (2004). Illustrative GLOBAL proxy; prefer published residual-mix / supplier-specific rates for filings.",
  },
  {
    key: "district_heat",
    label: "District heat and steam (GHG Protocol 2004 seed)",
    value: 0.2,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "GHGProtocol",
    standard: "GHGProtocol2004",
    sourceUrl: GHG_2004_URL,
    publicationYear: 2004,
    region: "GLOBAL",
    validFrom: "2004-01-01",
    uncertaintyPct: 25,
    licence: "GHG Protocol — free use with attribution / seed proxy",
    attributionText:
      "Illustrative GLOBAL district heat / steam / cooling factor for GHG Protocol Corporate Standard (2004) seed inventories. Prefer regional published heat-network factors for filings.",
  },

  // —— IPCC (GLOBAL core) ——
  {
    key: "grid_electricity",
    label: "Grid electricity (IPCC proxy)",
    value: 0.48,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 20,
    licence: "IPCC — free use with attribution",
    attributionText:
      "Illustrative electricity factor for IPCC-aligned inventories. Prefer national grid factors for filings.",
  },
  {
    key: "diesel",
    label: "Diesel (IPCC)",
    value: 2.7,
    unit: "kgCO2e/L",
    scope: "1",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 7,
    licence: "IPCC — free use with attribution",
    attributionText:
      "Illustrative diesel combustion factor aligned with IPCC Guidelines for National Greenhouse Gas Inventories (2006).",
  },
  {
    key: "natural_gas",
    label: "Natural gas (IPCC)",
    value: 1.96,
    unit: "kgCO2e/m³",
    scope: "1",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 7,
    licence: "IPCC — free use with attribution",
    attributionText:
      "Illustrative natural gas combustion factor aligned with IPCC 2006 Guidelines.",
  },
  {
    key: "petrol",
    label: "Petrol / gasoline (IPCC)",
    value: 2.28,
    unit: "kgCO2e/L",
    scope: "1",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 7,
    licence: "IPCC — free use with attribution",
    attributionText:
      "Illustrative gasoline combustion factor aligned with IPCC 2006 Guidelines.",
  },
  {
    key: "spend_purchased_goods",
    label: "Spend-based purchased goods (IPCC proxy)",
    value: 0.42,
    unit: "kgCO2e/GBP",
    scope: "3",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 40,
    licence: "IPCC — free use with attribution",
    attributionText:
      "Seed spend-based Scope 3 proxy for IPCC-aligned corporate inventories.",
  },
  {
    key: "business_travel_avg",
    label: "Business travel average (IPCC proxy)",
    value: 0.16,
    unit: "kgCO2e/km",
    scope: "3",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 25,
    licence: "IPCC — free use with attribution",
    attributionText: "Seed Scope 3 business-travel average for IPCC-aligned inventories.",
  },
  // residual_mix — GLOBAL seed for IPCC-aligned inventories (demo Non-paid value).
  {
    key: "residual_mix",
    label: "Residual mix electricity (IPCC seed)",
    value: 0.52,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 25,
    licence: "IPCC — free use with attribution / seed proxy",
    attributionText:
      "Seed residual-mix factor for market-based Scope 2 unmatched kWh (IPCC-aligned). Illustrative GLOBAL proxy; replace with national residual-mix publications for filings.",
  },
  {
    key: "district_heat",
    label: "District heat and steam (IPCC seed)",
    value: 0.19,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "IPCC",
    standard: "IPCC",
    sourceUrl: IPCC_URL,
    publicationYear: 2006,
    region: "GLOBAL",
    validFrom: "2006-01-01",
    uncertaintyPct: 25,
    licence: "IPCC — free use with attribution / seed proxy",
    attributionText:
      "Illustrative GLOBAL district heat / steam / cooling factor for IPCC-aligned seed inventories. Prefer national heat-network factors for filings.",
  },

  // —— Scope 3 Cat 6 / 7 calc-engine factors (kgCO2e per activity unit) ——
  ...scope3TravelCommuteCalcFactors(),

  // —— Scope 3 Cat 4 / 9 freight calc-engine factors (kgCO2e/tkm) ——
  ...scope3FreightCalcFactors(),

  // —— Scope 3 activity keys (registry-backed; formerly hardcoded DEFRA/IPCC) ——
  ...scope3ActivityFactors(),
];

/**
 * Mode-split Cat 6 travel + Cat 7 commute factors for lib/calc (tco2eFrom = qty × kg / 1000).
 * Distinct from scope3_* activity-path rows (tCO2e/mile style for Scope3Activities).
 */
function scope3TravelCommuteCalcFactors(): EmissionFactorSeed[] {
  type ModeRow = {
    key: string;
    label: string;
    unit: string;
    defra: number;
    ghg: number;
    ipcc: number;
    uncertaintyPct: number;
  };

  const modes: ModeRow[] = [
    {
      key: "business_travel_air_short",
      label: "Business travel — air short haul",
      unit: "kgCO2e/km",
      defra: 0.255,
      ghg: 0.24,
      ipcc: 0.25,
      uncertaintyPct: 15,
    },
    {
      key: "business_travel_air_long",
      label: "Business travel — air long haul",
      unit: "kgCO2e/km",
      defra: 0.148,
      ghg: 0.14,
      ipcc: 0.145,
      uncertaintyPct: 15,
    },
    {
      key: "business_travel_rail",
      label: "Business travel — rail",
      unit: "kgCO2e/km",
      defra: 0.035,
      ghg: 0.04,
      ipcc: 0.038,
      uncertaintyPct: 20,
    },
    {
      key: "business_travel_car",
      label: "Business travel — car",
      unit: "kgCO2e/km",
      defra: 0.171,
      ghg: 0.17,
      ipcc: 0.17,
      uncertaintyPct: 15,
    },
    {
      key: "business_travel_hotel",
      label: "Business travel — hotel night",
      unit: "kgCO2e/night",
      defra: 13.9,
      ghg: 14,
      ipcc: 14,
      uncertaintyPct: 25,
    },
    {
      key: "employee_commute_car",
      label: "Employee commute — car",
      unit: "kgCO2e/km",
      defra: 0.171,
      ghg: 0.17,
      ipcc: 0.17,
      uncertaintyPct: 20,
    },
    {
      key: "employee_commute_public",
      label: "Employee commute — public transport",
      unit: "kgCO2e/km",
      defra: 0.048,
      ghg: 0.05,
      ipcc: 0.05,
      uncertaintyPct: 25,
    },
    {
      key: "employee_commute_bicycle",
      label: "Employee commute — bicycle",
      unit: "kgCO2e/km",
      defra: 0,
      ghg: 0,
      ipcc: 0,
      uncertaintyPct: 5,
    },
  ];

  const out: EmissionFactorSeed[] = [];

  for (const mode of modes) {
    out.push({
      key: mode.key,
      label: `${mode.label} (DEFRA)`,
      value: mode.defra,
      unit: mode.unit,
      scope: "3",
      source: "DEFRA",
      standard: "DEFRA",
      sourceUrl: DEFRA_URL,
      publicationYear: 2024,
      region: "GB",
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      uncertaintyPct: mode.uncertaintyPct,
      licence: "OGL v3.0",
      attributionText:
        "Contains public sector information licensed under the Open Government Licence v3.0. Seed mode-split Scope 3 factor derived from DESNZ / DEFRA conversion factors 2024.",
    });
    out.push({
      key: mode.key,
      label: `${mode.label} (GHG Protocol 2004)`,
      value: mode.ghg,
      unit: mode.unit,
      scope: "3",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      sourceUrl: GHG_2004_URL,
      publicationYear: 2004,
      region: "GLOBAL",
      validFrom: "2004-01-01",
      uncertaintyPct: mode.uncertaintyPct + 5,
      licence: "GHG Protocol — free use with attribution",
      attributionText:
        "Seed Scope 3 mode-split travel/commute factor under GHG Protocol Corporate Standard (2004).",
    });
    out.push({
      key: mode.key,
      label: `${mode.label} (IPCC)`,
      value: mode.ipcc,
      unit: mode.unit,
      scope: "3",
      source: "IPCC",
      standard: "IPCC",
      sourceUrl: IPCC_URL,
      publicationYear: 2006,
      region: "GLOBAL",
      validFrom: "2006-01-01",
      uncertaintyPct: mode.uncertaintyPct + 5,
      licence: "IPCC — free use with attribution",
      attributionText:
        "Seed Scope 3 mode-split travel/commute factor for IPCC-aligned corporate inventories.",
    });
  }

  return out;
}

/**
 * Mode-split Cat 4 / Cat 9 freight factors for lib/calc (tco2eFrom = tkm × kg / 1000).
 * Same mode keys serve upstream and downstream; category is encoded on the metric.
 */
function scope3FreightCalcFactors(): EmissionFactorSeed[] {
  type ModeRow = {
    key: string;
    label: string;
    unit: string;
    defra: number;
    ghg: number;
    ipcc: number;
    uncertaintyPct: number;
  };

  const modes: ModeRow[] = [
    {
      key: "freight_road",
      label: "Freight — road (HGV average)",
      unit: "kgCO2e/tkm",
      defra: 0.12,
      ghg: 0.11,
      ipcc: 0.115,
      uncertaintyPct: 20,
    },
    {
      key: "freight_rail",
      label: "Freight — rail",
      unit: "kgCO2e/tkm",
      defra: 0.028,
      ghg: 0.03,
      ipcc: 0.03,
      uncertaintyPct: 25,
    },
    {
      key: "freight_sea",
      label: "Freight — sea / ocean",
      unit: "kgCO2e/tkm",
      defra: 0.016,
      ghg: 0.015,
      ipcc: 0.016,
      uncertaintyPct: 25,
    },
    {
      key: "freight_air",
      label: "Freight — air",
      unit: "kgCO2e/tkm",
      defra: 1.057,
      ghg: 1.0,
      ipcc: 1.02,
      uncertaintyPct: 20,
    },
  ];

  const out: EmissionFactorSeed[] = [];

  for (const mode of modes) {
    out.push({
      key: mode.key,
      label: `${mode.label} (DEFRA)`,
      value: mode.defra,
      unit: mode.unit,
      scope: "3",
      source: "DEFRA",
      standard: "DEFRA",
      sourceUrl: DEFRA_URL,
      publicationYear: 2024,
      region: "GB",
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      uncertaintyPct: mode.uncertaintyPct,
      licence: "OGL v3.0",
      attributionText:
        "Contains public sector information licensed under the Open Government Licence v3.0. Seed freight Scope 3 factor derived from DESNZ / DEFRA conversion factors 2024.",
    });
    out.push({
      key: mode.key,
      label: `${mode.label} (GHG Protocol 2004)`,
      value: mode.ghg,
      unit: mode.unit,
      scope: "3",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      sourceUrl: GHG_2004_URL,
      publicationYear: 2004,
      region: "GLOBAL",
      validFrom: "2004-01-01",
      uncertaintyPct: mode.uncertaintyPct + 5,
      licence: "GHG Protocol — free use with attribution",
      attributionText:
        "Seed Scope 3 freight factor under GHG Protocol Corporate Standard (2004).",
    });
    out.push({
      key: mode.key,
      label: `${mode.label} (IPCC)`,
      value: mode.ipcc,
      unit: mode.unit,
      scope: "3",
      source: "IPCC",
      standard: "IPCC",
      sourceUrl: IPCC_URL,
      publicationYear: 2006,
      region: "GLOBAL",
      validFrom: "2006-01-01",
      uncertaintyPct: mode.uncertaintyPct + 5,
      licence: "IPCC — free use with attribution",
      attributionText:
        "Seed Scope 3 freight factor for IPCC-aligned corporate inventories.",
    });
  }

  return out;
}

function scope3ActivityFactors(): EmissionFactorSeed[] {
  type Row = {
    key: string;
    label: string;
    value: number;
    unit: string;
    source: "DEFRA" | "IPCC" | "GHGProtocol";
    standard: EmissionsStandard;
    year: number;
    uncertaintyPct: number;
    url: string;
  };

  const rows: Row[] = [
    // DEFRA (moved from hardcoded service)
    {
      key: "scope3_supplier_general_procurement",
      label: "Supplier spend — general procurement",
      value: 0.00015,
      unit: "£",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 15,
      url: DEFRA_URL,
    },
    {
      key: "scope3_supplier_electronics",
      label: "Supplier spend — electronics",
      value: 0.00045,
      unit: "£",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 15,
      url: DEFRA_URL,
    },
    {
      key: "scope3_supplier_packaging",
      label: "Supplier spend — packaging",
      value: 0.00025,
      unit: "£",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 15,
      url: DEFRA_URL,
    },
    {
      key: "scope3_supplier_transport_services",
      label: "Supplier spend — transport services",
      value: 0.0001,
      unit: "£",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 30,
      url: DEFRA_URL,
    },
    {
      key: "scope3_waste_landfill",
      label: "Waste — landfill",
      value: 0.5,
      unit: "tonne",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_waste_recycling",
      label: "Waste — recycling",
      value: 0.05,
      unit: "tonne",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_waste_incineration",
      label: "Waste — incineration",
      value: 0.3,
      unit: "tonne",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_waste_composting",
      label: "Waste — composting",
      value: 0.02,
      unit: "tonne",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 15,
      url: DEFRA_URL,
    },
    {
      key: "scope3_business_travel_air_short_haul",
      label: "Business travel — air short haul",
      value: 0.00018,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_business_travel_air_long_haul",
      label: "Business travel — air long haul",
      value: 0.00009,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_business_travel_rail",
      label: "Business travel — rail",
      value: 0.000025,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_business_travel_car",
      label: "Business travel — car",
      value: 0.00021,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_business_travel_taxi",
      label: "Business travel — taxi",
      value: 0.00016,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 15,
      url: DEFRA_URL,
    },
    {
      key: "scope3_employee_commute_car",
      label: "Employee commute — car",
      value: 0.00021,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_employee_commute_public_transport",
      label: "Employee commute — public transport",
      value: 0.00003,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 15,
      url: DEFRA_URL,
    },
    {
      key: "scope3_employee_commute_bicycle",
      label: "Employee commute — bicycle",
      value: 0,
      unit: "mile",
      source: "DEFRA",
      standard: "DEFRA",
      year: 2023,
      uncertaintyPct: 5,
      url: DEFRA_URL,
    },
    {
      key: "scope3_investment_fossil_fuels",
      label: "Investment — fossil fuels",
      value: 500,
      unit: "£1M",
      source: "IPCC",
      standard: "IPCC",
      year: 2023,
      uncertaintyPct: 15,
      url: IPCC_URL,
    },
    {
      key: "scope3_investment_technology",
      label: "Investment — technology",
      value: 100,
      unit: "£1M",
      source: "IPCC",
      standard: "IPCC",
      year: 2023,
      uncertaintyPct: 30,
      url: IPCC_URL,
    },
    {
      key: "scope3_investment_renewable_energy",
      label: "Investment — renewable energy",
      value: 20,
      unit: "£1M",
      source: "IPCC",
      standard: "IPCC",
      year: 2023,
      uncertaintyPct: 15,
      url: IPCC_URL,
    },
    {
      key: "scope3_investment_real_estate",
      label: "Investment — real estate",
      value: 150,
      unit: "£1M",
      source: "IPCC",
      standard: "IPCC",
      year: 2023,
      uncertaintyPct: 30,
      url: IPCC_URL,
    },

    // GHG Protocol 2004 mirrors for activity keys (audit default)
    {
      key: "scope3_supplier_general_procurement",
      label: "Supplier spend — general procurement (GHG Protocol 2004)",
      value: 0.00014,
      unit: "£",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_supplier_electronics",
      label: "Supplier spend — electronics (GHG Protocol 2004)",
      value: 0.0004,
      unit: "£",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_supplier_packaging",
      label: "Supplier spend — packaging (GHG Protocol 2004)",
      value: 0.00022,
      unit: "£",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_supplier_transport_services",
      label: "Supplier spend — transport services (GHG Protocol 2004)",
      value: 0.00009,
      unit: "£",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_waste_landfill",
      label: "Waste — landfill (GHG Protocol 2004)",
      value: 0.48,
      unit: "tonne",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 20,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_waste_recycling",
      label: "Waste — recycling (GHG Protocol 2004)",
      value: 0.04,
      unit: "tonne",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 25,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_waste_incineration",
      label: "Waste — incineration (GHG Protocol 2004)",
      value: 0.28,
      unit: "tonne",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 20,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_waste_composting",
      label: "Waste — composting (GHG Protocol 2004)",
      value: 0.018,
      unit: "tonne",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 25,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_business_travel_air_short_haul",
      label: "Business travel — air short haul (GHG Protocol 2004)",
      value: 0.00017,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 20,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_business_travel_air_long_haul",
      label: "Business travel — air long haul (GHG Protocol 2004)",
      value: 0.000085,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 20,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_business_travel_rail",
      label: "Business travel — rail (GHG Protocol 2004)",
      value: 0.000022,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 20,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_business_travel_car",
      label: "Business travel — car (GHG Protocol 2004)",
      value: 0.0002,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 15,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_business_travel_taxi",
      label: "Business travel — taxi (GHG Protocol 2004)",
      value: 0.00015,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 20,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_employee_commute_car",
      label: "Employee commute — car (GHG Protocol 2004)",
      value: 0.0002,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 15,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_employee_commute_public_transport",
      label: "Employee commute — public transport (GHG Protocol 2004)",
      value: 0.000028,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 25,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_employee_commute_bicycle",
      label: "Employee commute — bicycle (GHG Protocol 2004)",
      value: 0,
      unit: "mile",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 5,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_investment_fossil_fuels",
      label: "Investment — fossil fuels (GHG Protocol 2004)",
      value: 480,
      unit: "£1M",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_investment_technology",
      label: "Investment — technology (GHG Protocol 2004)",
      value: 95,
      unit: "£1M",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_investment_renewable_energy",
      label: "Investment — renewable energy (GHG Protocol 2004)",
      value: 18,
      unit: "£1M",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
    {
      key: "scope3_investment_real_estate",
      label: "Investment — real estate (GHG Protocol 2004)",
      value: 140,
      unit: "£1M",
      source: "GHGProtocol",
      standard: "GHGProtocol2004",
      year: 2004,
      uncertaintyPct: 40,
      url: GHG_2004_URL,
    },
  ];

  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value,
    unit: r.unit,
    scope: "3" as const,
    source: r.source,
    standard: r.standard,
    sourceUrl: r.url,
    publicationYear: r.year,
    region: "GLOBAL",
    validFrom: `${r.year}-01-01`,
    uncertaintyPct: r.uncertaintyPct,
    licence:
      r.source === "DEFRA"
        ? "OGL v3.0"
        : r.source === "IPCC"
          ? "IPCC — free use with attribution"
          : "GHG Protocol — free use with attribution",
    attributionText: `${r.label}. Source: ${r.source}. Standard: ${r.standard}. Seed registry row — not hardcoded in calc.`,
  }));
}
