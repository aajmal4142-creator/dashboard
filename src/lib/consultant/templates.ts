/**
 * Reusable datapoint key sets by NACE sector prefix.
 * Consultants assign a template to seed client collection priorities.
 */
export type SectorTemplate = {
  id: string;
  label: string;
  nacePrefix: string;
  metricKeys: string[];
};

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  {
    id: "manufacturing",
    label: "Manufacturing (C)",
    nacePrefix: "C",
    metricKeys: [
      "electricity_kwh",
      "electricity_renewable_pct",
      "diesel_litres",
      "natural_gas_m3",
      "supplier_spend_total",
      "employees_total",
      "injuries_recordable",
      "hours_worked_total",
    ],
  },
  {
    id: "services",
    label: "IT / Professional services (J/M)",
    nacePrefix: "J",
    metricKeys: [
      "electricity_kwh",
      "electricity_renewable_pct",
      "business_travel_km",
      "employees_total",
      "employees_women",
      "training_hours_total",
      "policy_data_privacy",
      "board_independent",
    ],
  },
  {
    id: "wholesale",
    label: "Wholesale / logistics (G/H)",
    nacePrefix: "G",
    metricKeys: [
      "electricity_kwh",
      "diesel_litres",
      "petrol_litres",
      "business_travel_km",
      "supplier_spend_total",
      "employees_total",
      "policy_anti_corruption",
    ],
  },
];

export function templateForSector(sector: string): SectorTemplate {
  const prefix = sector.trim().charAt(0).toUpperCase();
  return SECTOR_TEMPLATES.find((t) => t.nacePrefix === prefix) ?? SECTOR_TEMPLATES[1]!;
}
