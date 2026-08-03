/**
 * lib/calc/wasteWater.ts — operational water (E3) + waste (E5) metrics,
 * optional Scope 3 Cat 5 waste GHG when disposal factors resolve.
 *
 * Pure. Zero I/O. Factors come from the registry via tryResolveFactor —
 * missing factors never invent emissions; activity still tracks as operational.
 */
import { tryResolveFactor } from "./resolveFactor";
import type { DatapointValue, FactorRecord, Measured, Quality } from "./types";
import type { EmissionComponent, ScopeComputation } from "./emissions";

export const WASTE_WATER_FACTOR_KEYS = {
  wasteLandfill: "scope3_waste_landfill",
  wasteRecycling: "scope3_waste_recycling",
} as const;

export const WASTE_WATER_METRIC_KEYS = {
  waterWithdrawal: "water_withdrawal_m3",
  waterDischarge: "water_discharge_m3",
  /** Preferred generated-waste key. */
  wasteGenerated: "waste_generated_tonnes",
  /** Legacy supplier-questionnaire alias for generated waste. */
  wasteTonnesLegacy: "waste_tonnes",
  wasteRecycled: "waste_recycled_tonnes",
  wasteToLandfill: "waste_to_landfill_tonnes",
  employeesTotal: "employees_total",
} as const;

export type WasteWaterGroup = "water" | "waste" | "waste_legacy";

export const WATER_ACTIVITY_FIELDS = [
  {
    metricKey: WASTE_WATER_METRIC_KEYS.waterWithdrawal,
    label: "Water withdrawal",
    unit: "m³",
    group: "water" as const,
  },
  {
    metricKey: WASTE_WATER_METRIC_KEYS.waterDischarge,
    label: "Water discharge",
    unit: "m³",
    group: "water" as const,
  },
] as const;

/** Disposal-route metrics that can feed optional Cat 5 GHG. */
export const WASTE_DISPOSAL_MODES = [
  {
    metricKey: WASTE_WATER_METRIC_KEYS.wasteToLandfill,
    factorKey: WASTE_WATER_FACTOR_KEYS.wasteLandfill,
    componentKey: "waste_landfill",
    label: "Waste to landfill",
    unit: "t",
    group: "waste" as const,
  },
  {
    metricKey: WASTE_WATER_METRIC_KEYS.wasteRecycled,
    factorKey: WASTE_WATER_FACTOR_KEYS.wasteRecycling,
    componentKey: "waste_recycled",
    label: "Waste recycled",
    unit: "t",
    group: "waste" as const,
  },
] as const;

export const WASTE_ACTIVITY_FIELDS = [
  {
    metricKey: WASTE_WATER_METRIC_KEYS.wasteGenerated,
    label: "Waste generated",
    unit: "t",
    group: "waste" as const,
  },
  ...WASTE_DISPOSAL_MODES.map((m) => ({
    metricKey: m.metricKey,
    label: m.label,
    unit: m.unit,
    group: m.group,
  })),
  {
    metricKey: WASTE_WATER_METRIC_KEYS.wasteTonnesLegacy,
    label: "Waste (legacy aggregate)",
    unit: "t",
    group: "waste_legacy" as const,
  },
] as const;

export const WASTE_WATER_ACTIVITY_FIELDS = [
  ...WATER_ACTIVITY_FIELDS,
  ...WASTE_ACTIVITY_FIELDS,
] as const;

export const WASTE_WATER_ALL_METRIC_KEYS = [
  ...WATER_ACTIVITY_FIELDS.map((f) => f.metricKey),
  ...WASTE_ACTIVITY_FIELDS.map((f) => f.metricKey),
  WASTE_WATER_METRIC_KEYS.employeesTotal,
] as const;

function tco2eFrom(quantity: number, factor: FactorRecord): number {
  return (quantity * factor.value) / 1000;
}

function metric(
  metrics: Record<string, DatapointValue>,
  key: string,
): DatapointValue | undefined {
  return metrics[key];
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

/**
 * Prefer waste_generated_tonnes; fall back to questionnaire waste_tonnes.
 * Never double-count — generated wins when both present.
 */
export function resolveWasteGenerated(
  metrics: Record<string, DatapointValue>,
): { metricKey: string; datapoint: DatapointValue } | null {
  const preferred = metric(metrics, WASTE_WATER_METRIC_KEYS.wasteGenerated);
  if (preferred && preferred.value !== null) {
    return {
      metricKey: WASTE_WATER_METRIC_KEYS.wasteGenerated,
      datapoint: preferred,
    };
  }
  const legacy = metric(metrics, WASTE_WATER_METRIC_KEYS.wasteTonnesLegacy);
  if (legacy && legacy.value !== null) {
    return {
      metricKey: WASTE_WATER_METRIC_KEYS.wasteTonnesLegacy,
      datapoint: legacy,
    };
  }
  return null;
}

export type WasteCat5Computation = ScopeComputation & {
  /** True when at least one disposal factor resolved for a present metric. */
  emissionsComputed: boolean;
  /** Disposal metrics present but factor missing in registry. */
  missingFactors: string[];
};

/**
 * Scope 3 Cat 5 (waste generated in operations) — optional.
 * Uses tryResolveFactor: present activity without a seeded factor stays
 * operational-only (no throw, no silent zero emissions).
 */
export function computeWasteCat5(
  metrics: Record<string, DatapointValue>,
  factors: FactorRecord[],
  region: string,
  year: number,
): WasteCat5Computation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];
  const missingFactors: string[] = [];

  for (const mode of WASTE_DISPOSAL_MODES) {
    const dp = metric(metrics, mode.metricKey);
    if (!dp || dp.value === null) {
      missingInputs.push(mode.metricKey);
      continue;
    }
    const factor = tryResolveFactor(factors, mode.factorKey, region, year);
    if (!factor) {
      missingFactors.push(mode.factorKey);
      continue;
    }
    components.push({
      key: mode.componentKey,
      label: mode.label,
      valueTco2e: tco2eFrom(dp.value, factor),
      factor,
    });
  }

  return {
    measured: summarise(components),
    components,
    missingInputs,
    emissionsComputed: components.length > 0,
    missingFactors,
  };
}

export type IntensityResult = {
  value: number | null;
  unit: string;
  quality: Quality;
  explanation?: string;
};

/**
 * Water withdrawal intensity (m³ / FTE). Missing either side → quality missing.
 */
export function waterIntensityPerFte(
  withdrawalM3: number | null | undefined,
  employeesFte: number | null | undefined,
): IntensityResult {
  const unit = "m³/FTE";
  if (
    withdrawalM3 === null ||
    withdrawalM3 === undefined ||
    !Number.isFinite(withdrawalM3)
  ) {
    return {
      value: null,
      unit,
      quality: "missing",
      explanation: `Missing ${WASTE_WATER_METRIC_KEYS.waterWithdrawal}.`,
    };
  }
  if (
    employeesFte === null ||
    employeesFte === undefined ||
    !Number.isFinite(employeesFte) ||
    employeesFte <= 0
  ) {
    return {
      value: null,
      unit,
      quality: "missing",
      explanation: `Missing or zero ${WASTE_WATER_METRIC_KEYS.employeesTotal}.`,
    };
  }
  return {
    value: withdrawalM3 / employeesFte,
    unit,
    quality: "calculated",
  };
}

/**
 * Recycled ÷ generated. Uses resolveWasteGenerated for the denominator.
 * Null when generated missing/zero — never invent diversion.
 */
export function wasteDiversionRate(
  metrics: Record<string, DatapointValue>,
): IntensityResult {
  const unit = "%";
  const generated = resolveWasteGenerated(metrics);
  const recycled = metric(metrics, WASTE_WATER_METRIC_KEYS.wasteRecycled);
  if (!generated || generated.datapoint.value === null) {
    return {
      value: null,
      unit,
      quality: "missing",
      explanation: "Waste generated is missing.",
    };
  }
  if (generated.datapoint.value <= 0) {
    return {
      value: null,
      unit,
      quality: "missing",
      explanation: "Waste generated is zero; diversion rate is undefined.",
    };
  }
  if (!recycled || recycled.value === null) {
    return {
      value: null,
      unit,
      quality: "missing",
      explanation: `Missing ${WASTE_WATER_METRIC_KEYS.wasteRecycled}.`,
    };
  }
  return {
    value: (recycled.value / generated.datapoint.value) * 100,
    unit,
    quality: "calculated",
  };
}

/** Metric keys with absent values — coverage gaps for the operational UI. */
export function wasteWaterCoverageGaps(
  activities: Array<{ metricKey: string; value: number | null; group: string }>,
): string[] {
  return activities
    .filter((a) => a.group !== "waste_legacy" && a.value === null)
    .map((a) => a.metricKey);
}
