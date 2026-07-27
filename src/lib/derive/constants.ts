/**
 * Energy-content conversion constants for the derivation layer.
 * These are NOT emission factors — they convert activity units → MWh.
 * Sourced from DESNZ/DEFRA conversion factors energy basis (OGL).
 * Emission factors stay in the EmissionFactor registry.
 */
export const ENERGY_CONTENT = {
  diesel_mwh_per_l: {
    value: 0.0101,
    unit: "MWh/L",
    label: "Diesel net calorific value",
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. DESNZ/DEFRA conversion factors 2024 — energy basis for diesel.",
  },
  petrol_mwh_per_l: {
    value: 0.0097,
    unit: "MWh/L",
    label: "Petrol net calorific value",
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. DESNZ/DEFRA conversion factors 2024 — energy basis for petrol.",
  },
  natural_gas_mwh_per_m3: {
    value: 0.011,
    unit: "MWh/m³",
    label: "Natural gas gross calorific value (approx.)",
    sourceUrl:
      "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    licence: "OGL v3.0",
    attributionText:
      "Contains public sector information licensed under the Open Government Licence v3.0. DESNZ/DEFRA conversion factors 2024 — energy basis for natural gas.",
  },
} as const;

export const KWH_PER_MWH = 1000;
