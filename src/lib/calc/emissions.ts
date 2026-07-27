/**
 * lib/calc/emissions.ts — BUILD_PLAN §5.
 *
 * Formulas, implemented exactly:
 *   Scope 2 = electricity_kWh × factor(grid, region, year) / 1000                    → tCO2e
 *   Scope 1 = (diesel_L × factor(diesel) + gas_m3 × factor(gas)) / 1000              → tCO2e
 *             (+ petrol_L × factor(petrol) / 1000 when present)
 *   Scope 3 = (prefer) supplier_spend_estimate_tco2e
 *             else supplier_spend_total × factor(spend) / 1000
 *             + business_travel_km × factor(travel) / 1000
 *             + supplier_reported_tco2e (primary submissions; already tCO2e)
 *
 * When provenance-aware reaggregation feeds both estimate and primary totals,
 * spend_total is omitted so the same supplier is never double-counted.
 *
 * A component is only added when its metric is present (value !== null). Absent
 * components are never treated as zero — they are simply left out of the sum, and
 * the scope's own quality drops to "missing" only when every component is absent.
 */
import { resolveFactor } from "./resolveFactor";
import type { DatapointValue, FactorRecord, Measured, Quality } from "./types";

export const FACTOR_KEYS = {
  grid: "grid_electricity",
  diesel: "diesel",
  naturalGas: "natural_gas",
  petrol: "petrol",
  spend: "spend_purchased_goods",
  travel: "business_travel_avg",
} as const;

export const METRIC_KEYS = {
  electricity: "electricity_kwh",
  diesel: "diesel_litres",
  naturalGas: "natural_gas_m3",
  petrol: "petrol_litres",
  supplierSpend: "supplier_spend_total",
  /** Pre-rolled spend×factor tCO2e (provenance spend_estimate). Prefer over raw spend. */
  supplierSpendEstimate: "supplier_spend_estimate_tco2e",
  businessTravel: "business_travel_km",
  supplierReported: "supplier_reported_tco2e",
} as const;

export interface EmissionComponent {
  key: string;
  label: string;
  valueTco2e: number;
  factor: FactorRecord;
}

export interface ScopeComputation {
  measured: Measured;
  components: EmissionComponent[];
  missingInputs: string[];
}

function tco2eFrom(quantity: number, factor: FactorRecord): number {
  return (quantity * factor.value) / 1000;
}

function summarise(components: EmissionComponent[]): Measured {
  if (components.length === 0) {
    return { value: 0, unit: "tCO2e", quality: "missing" };
  }
  const value = components.reduce((sum, c) => sum + c.valueTco2e, 0);
  const quality: Quality = "calculated";
  if (components.length === 1) {
    return { value, unit: "tCO2e", quality, factorId: components[0].factor.id };
  }
  return { value, unit: "tCO2e", quality };
}

function metric(
  metrics: Record<string, DatapointValue>,
  key: string,
): DatapointValue | undefined {
  return metrics[key];
}

export function computeScope1(
  metrics: Record<string, DatapointValue>,
  factors: FactorRecord[],
  region: string,
  year: number,
): ScopeComputation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];

  const diesel = metric(metrics, METRIC_KEYS.diesel);
  if (diesel && diesel.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.diesel, region, year);
    components.push({
      key: "diesel",
      label: "Diesel",
      valueTco2e: tco2eFrom(diesel.value, factor),
      factor,
    });
  } else {
    missingInputs.push(METRIC_KEYS.diesel);
  }

  const gas = metric(metrics, METRIC_KEYS.naturalGas);
  if (gas && gas.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.naturalGas, region, year);
    components.push({
      key: "natural_gas",
      label: "Natural gas",
      valueTco2e: tco2eFrom(gas.value, factor),
      factor,
    });
  } else {
    missingInputs.push(METRIC_KEYS.naturalGas);
  }

  const petrol = metric(metrics, METRIC_KEYS.petrol);
  if (petrol && petrol.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.petrol, region, year);
    components.push({
      key: "petrol",
      label: "Petrol",
      valueTco2e: tco2eFrom(petrol.value, factor),
      factor,
    });
  } else {
    missingInputs.push(METRIC_KEYS.petrol);
  }

  return { measured: summarise(components), components, missingInputs };
}

export function computeScope2(
  metrics: Record<string, DatapointValue>,
  factors: FactorRecord[],
  region: string,
  year: number,
): ScopeComputation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];

  const electricity = metric(metrics, METRIC_KEYS.electricity);
  if (electricity && electricity.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.grid, region, year);
    components.push({
      key: "electricity",
      label: "Grid electricity",
      valueTco2e: tco2eFrom(electricity.value, factor),
      factor,
    });
  } else {
    missingInputs.push(METRIC_KEYS.electricity);
  }

  return { measured: summarise(components), components, missingInputs };
}

export function computeScope3(
  metrics: Record<string, DatapointValue>,
  factors: FactorRecord[],
  region: string,
  year: number,
): ScopeComputation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];

  const spendEstimate = metric(metrics, METRIC_KEYS.supplierSpendEstimate);
  if (spendEstimate && spendEstimate.value !== null) {
    // Already tCO2e from provenance-aware reaggregation — do not also apply spend×factor.
    components.push({
      key: "supplier_spend_estimate",
      label: "Supplier spend (estimate)",
      valueTco2e: spendEstimate.value,
      factor: {
        id: "spend-estimate-rolled",
        key: METRIC_KEYS.supplierSpendEstimate,
        value: 1,
        unit: "tCO2e",
        source: "spend_estimate",
        publicationYear: year,
        region: "GLOBAL",
      },
    });
  } else {
    const spend = metric(metrics, METRIC_KEYS.supplierSpend);
    if (spend && spend.value !== null) {
      const factor = resolveFactor(factors, FACTOR_KEYS.spend, region, year);
      components.push({
        key: "supplier_spend",
        label: "Supplier spend",
        valueTco2e: tco2eFrom(spend.value, factor),
        factor,
      });
    } else {
      missingInputs.push(METRIC_KEYS.supplierSpend);
    }
  }

  const travel = metric(metrics, METRIC_KEYS.businessTravel);
  if (travel && travel.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.travel, region, year);
    components.push({
      key: "business_travel",
      label: "Business travel",
      valueTco2e: tco2eFrom(travel.value, factor),
      factor,
    });
  } else {
    missingInputs.push(METRIC_KEYS.businessTravel);
  }

  // Σ(direct supplier-reported) — already tCO2e; no emission factor applied.
  // When fed from composeScope3, this is primary-only (estimates excluded).
  const reported = metric(metrics, METRIC_KEYS.supplierReported);
  if (reported && reported.value !== null) {
    components.push({
      key: "supplier_reported",
      label: "Supplier-reported",
      valueTco2e: reported.value,
      factor: {
        id: "direct-supplier-reported",
        key: METRIC_KEYS.supplierReported,
        value: 1,
        unit: "tCO2e",
        source: "supplier_submission",
        publicationYear: year,
        region: "GLOBAL",
      },
    });
  }

  return { measured: summarise(components), components, missingInputs };
}
