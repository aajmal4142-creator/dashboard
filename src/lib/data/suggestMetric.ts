/** Heuristic metric suggestion from an uploaded evidence filename. */

const RULES: Array<{ re: RegExp; metricKey: string; label: string }> = [
  {
    re: /electric|kwh|power|utility|edf|sse|octopus/i,
    metricKey: "electricity_kwh",
    label: "Electricity (kWh)",
  },
  { re: /gas|therm|btu/i, metricKey: "natural_gas_m3", label: "Natural gas (m³)" },
  { re: /diesel|gasoil/i, metricKey: "diesel_litres", label: "Diesel" },
  { re: /petrol|gasoline|fuel/i, metricKey: "petrol_litres", label: "Petrol" },
  {
    re: /district|heat|steam|cooling/i,
    metricKey: "district_heat_kwh",
    label: "District heat",
  },
  {
    re: /travel|flight|rail|mileage/i,
    metricKey: "business_travel_km",
    label: "Business travel",
  },
  {
    re: /payroll|headcount|fte|employee/i,
    metricKey: "employees_total",
    label: "Headcount (FTE)",
  },
  {
    re: /spend|invoice|purchas/i,
    metricKey: "supplier_spend_total",
    label: "Supplier spend",
  },
  {
    re: /supplier|scope.?3|vendor/i,
    metricKey: "supplier_reported_tco2e",
    label: "Supplier Scope 3",
  },
];

export function suggestMetricFromFilename(filename: string): {
  metricKey: string;
  label: string;
} | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  for (const rule of RULES) {
    if (rule.re.test(base)) {
      return { metricKey: rule.metricKey, label: rule.label };
    }
  }
  return null;
}
