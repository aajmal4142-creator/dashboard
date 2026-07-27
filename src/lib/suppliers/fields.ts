/**
 * Six-field public supplier questionnaire — ~90s to complete.
 * Values land as Supplier.submittedData; estimated_tco2e rolls into
 * org datapoint supplier_reported_tco2e (Scope 3 direct reports).
 */
export const SUPPLIER_FORM_FIELDS = [
  {
    key: "electricity_kwh",
    label: "Electricity consumed (annual)",
    unit: "kWh",
    required: true,
  },
  {
    key: "diesel_litres",
    label: "Diesel consumed (annual)",
    unit: "L",
    required: true,
  },
  {
    key: "natural_gas_m3",
    label: "Natural gas consumed (annual)",
    unit: "m³",
    required: true,
  },
  {
    key: "business_travel_km",
    label: "Business travel (annual)",
    unit: "km",
    required: true,
  },
  {
    key: "employees_total",
    label: "Employees (FTE)",
    unit: "FTE",
    required: true,
  },
  {
    key: "estimated_tco2e",
    label: "Your greenhouse gas emissions (if you already track them)",
    unit: "tCO2e",
    required: false,
  },
] as const;

export type SupplierFormFieldKey = (typeof SUPPLIER_FORM_FIELDS)[number]["key"];

export type SupplierFormValues = Partial<
  Record<SupplierFormFieldKey, number | null> & { is_metered?: boolean | null }
>;

export const SUPPLIER_REPORTED_METRIC = "supplier_reported_tco2e";
export const SUPPLIER_SPEND_ESTIMATE_METRIC = "supplier_spend_estimate_tco2e";

export const REQUEST_TTL_DAYS = 30;
export const REMINDER_DAYS = [7, 14] as const;
