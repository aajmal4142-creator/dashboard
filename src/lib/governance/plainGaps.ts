/** Everyday copy for runway gaps — what to do, not jargon. */

const PLAIN: Record<string, { need: string; action: string }> = {
  electricity_kwh: {
    need: "Need last period’s electricity bill (kWh).",
    action: "Enter electricity",
  },
  natural_gas_m3: {
    need: "Need natural gas use (m³) for the period.",
    action: "Enter gas",
  },
  diesel_litres: {
    need: "Need diesel litres used in the period.",
    action: "Enter diesel",
  },
  petrol_litres: {
    need: "Need petrol litres used in the period.",
    action: "Enter petrol",
  },
  employees_total: {
    need: "Need headcount (FTE) for the period.",
    action: "Confirm headcount",
  },
  business_travel_km: {
    need: "Need business travel kilometres.",
    action: "Enter travel",
  },
  supplier_spend_total: {
    need: "Need total supplier spend for the period.",
    action: "Enter supplier spend",
  },
  supplier_reported_tco2e: {
    need: "Need supplier emissions (or send requests).",
    action: "Chase suppliers",
  },
};

export function plainGapCopy(
  metricKey: string,
  fallbackLabel: string,
): {
  need: string;
  action: string;
} {
  return (
    PLAIN[metricKey] ?? {
      need: `Still missing: ${fallbackLabel}.`,
      action: `Add ${fallbackLabel}`,
    }
  );
}
