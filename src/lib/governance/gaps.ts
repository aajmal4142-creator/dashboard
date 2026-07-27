/**
 * Gap analysis — missing required datapoints ranked by impact×ease. §15.1.4
 *
 * Metric keys MUST match DATA_METRICS / MetricDefinition seeds (canonical calc keys).
 */

export type RequiredMetric = {
  metricKey: string;
  label: string;
  /** Higher = more impact on score/completeness. */
  impact: number;
  /** Higher = easier to collect. */
  ease: number;
};

/** Core metrics for CSRD-simplified / BRSR-readiness runway. */
export const REQUIRED_RUNWAY_METRICS: RequiredMetric[] = [
  { metricKey: "electricity_kwh", label: "Electricity (kWh)", impact: 10, ease: 9 },
  { metricKey: "natural_gas_m3", label: "Natural gas (m³)", impact: 8, ease: 7 },
  { metricKey: "diesel_litres", label: "Diesel", impact: 8, ease: 6 },
  { metricKey: "petrol_litres", label: "Petrol", impact: 6, ease: 6 },
  { metricKey: "employees_total", label: "Headcount (FTE)", impact: 7, ease: 10 },
  { metricKey: "business_travel_km", label: "Business travel", impact: 6, ease: 5 },
  { metricKey: "supplier_spend_total", label: "Supplier spend", impact: 7, ease: 6 },
  { metricKey: "supplier_reported_tco2e", label: "Supplier Scope 3", impact: 9, ease: 3 },
];

export type GapItem = RequiredMetric & {
  missing: boolean;
  rank: number;
};

export function rankGaps(
  presentKeys: Set<string>,
  required: RequiredMetric[] = REQUIRED_RUNWAY_METRICS,
): { missing: GapItem[]; collected: number; total: number } {
  const missing: GapItem[] = required
    .filter((m) => !presentKeys.has(m.metricKey))
    .map((m) => ({
      ...m,
      missing: true,
      rank: m.impact * m.ease,
    }))
    .sort((a, b) => b.rank - a.rank);

  return {
    missing,
    collected: required.length - missing.length,
    total: required.length,
  };
}
