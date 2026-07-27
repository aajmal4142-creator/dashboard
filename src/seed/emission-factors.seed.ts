export type EmissionFactorSeed = {
  key: string;
  label: string;
  value: number;
  unit: string;
  scope: "1" | "2" | "3";
  source: "DEFRA" | "EPA" | "CEA_India" | "EEA" | "NationalInventory";
  sourceUrl: string;
  publicationYear: number;
  region: string;
  validFrom: string;
  validUntil?: string;
  licence: string;
  attributionText: string;
};

/**
 * Open / redistributable factors only.
 * SKIPPED: IEA — licensed, not redistributable (§11).
 * EU grid: EEA / national inventory proxies, not IEA.
 *
 * Values are published figures from the cited sources for seed realism.
 * Calc engine must resolve by key/region/year — never hardcode these in lib/calc.
 */
export const emissionFactors: EmissionFactorSeed[] = [
  {
    key: "grid_electricity",
    label: "UK grid electricity (generation)",
    value: 0.207,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "DEFRA",
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl: "https://www.epa.gov/egrid/download-data",
    publicationYear: 2024,
    region: "US",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    licence: "US Government work (public domain)",
    attributionText:
      "Source: U.S. Environmental Protection Agency, eGRID. U.S. government works are generally public domain.",
  },
  {
    key: "grid_electricity",
    label: "India grid (CEA weighted average)",
    value: 0.727,
    unit: "kgCO2e/kWh",
    scope: "2",
    source: "CEA_India",
    sourceUrl: "https://cea.nic.in/coal-power-stations/?lang=en",
    publicationYear: 2024,
    region: "IN",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl:
      "https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1",
    publicationYear: 2024,
    region: "EU",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl: "https://www.gov.uk/government/statistics/uks-carbon-footprint",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
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
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    publicationYear: 2024,
    region: "GB",
    validFrom: "2024-01-01",
    validUntil: "2024-12-31",
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ / DEFRA conversion factors 2024.",
  },
];
