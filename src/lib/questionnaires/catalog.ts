export type QuestionnaireField = {
  id: string;
  label: string;
  metricKey: string;
};

export type QuestionnaireDef = {
  id: string;
  name: string;
  fields: QuestionnaireField[];
};

/** Deterministic EcoVadis-lite field map — no AI. §13.2 */
export const ECOVADIS_LITE: QuestionnaireDef = {
  id: "ecovadis-lite",
  name: "EcoVadis-lite / buyer ESG questionnaire",
  fields: [
    {
      id: "energy_kwh",
      label: "Electricity consumption (kWh)",
      metricKey: "electricity_kwh",
    },
    {
      id: "fuel_diesel",
      label: "Diesel (litres)",
      metricKey: "diesel_litres",
    },
    {
      id: "headcount",
      label: "Employees (FTE)",
      metricKey: "employees_total",
    },
    {
      id: "scope3_suppliers",
      label: "Supplier-reported tCO2e",
      metricKey: "supplier_reported_tco2e",
    },
    {
      id: "waste",
      label: "Waste (tonnes)",
      metricKey: "waste_tonnes",
    },
  ],
};

export const QUESTIONNAIRES: QuestionnaireDef[] = [ECOVADIS_LITE];

export function questionnaireById(id: string): QuestionnaireDef | undefined {
  return QUESTIONNAIRES.find((q) => q.id === id);
}
