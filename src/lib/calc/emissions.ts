/**
 * lib/calc/emissions.ts — BUILD_PLAN §5.
 *
 * Formulas, implemented exactly:
 *   Scope 2 location-based = (electricity_kWh × factor(grid)
 *                            + district_heat_kWh × factor(district_heat)) / 1000 → tCO2e
 *   Scope 2 market-based   = Σ(instrument_kWh × instrument_factor) / 1000
 *                          + unmatched_kWh × factor(residual_mix) / 1000
 *                          + district_heat_kWh × factor(district_heat) / 1000     → tCO2e
 *   Scope 1 = (diesel_L × factor(diesel) + gas_m3 × factor(gas)) / 1000              → tCO2e
 *             (+ petrol_L × factor(petrol) / 1000 when present)
 *   Scope 3 = (prefer) supplier_spend_estimate_tco2e
 *             else supplier_spend_total × factor(spend) / 1000
 *             + Cat 6 business travel:
 *                 prefer mode-split (air_short / air_long / rail / car / hotel_nights)
 *                   × mode factors / 1000
 *                 else business_travel_km × factor(travel) / 1000  (legacy aggregate)
 *             + Cat 7 employee commute mode-split × commute factors / 1000
 *             + Cat 4 upstream freight (road / rail / sea / air) × tkm factors / 1000
 *             + Cat 9 downstream freight (road / rail / sea / air) × tkm factors / 1000
 *             + Cat 5 waste (landfill / recycling tonnes) × waste factors / 1000
 *               when disposal metrics + registry factors are both present (optional;
 *               operational waste/water metrics track without forcing GHG)
 *             + supplier_reported_tco2e (primary submissions; already tCO2e)
 *
 * Freight split (GHG Protocol Scope 3):
 *   Cat 4 — Upstream transportation & distribution: tonne-km paid/controlled by the
 *     reporting company (inbound logistics, outbound between suppliers and own sites).
 *   Cat 9 — Downstream transportation & distribution: tonne-km of sold products after
 *     the point of sale, typically paid by the customer / third party.
 *   Activity = mode × distance × load as tonne-km (tkm). Factors are kgCO2e/tkm from
 *   the registry — never hardcoded. Same mode factors serve Cat 4 and Cat 9.
 *
 * Scope 2 dual reporting (GHG Protocol Scope 2 Quality Criteria):
 *   Always compute both location-based and market-based totals.
 *   - Location-based uses the grid average factor for the region/year, plus the
 *     district-heat registry factor when district_heat_kwh is present.
 *   - Market-based applies optional contractual instruments (RECs, GOs, supplier-
 *     specific rates) to matched electricity kWh only. Unmatched electricity uses
 *     the residual-mix factor when present in the registry; if residual-mix is
 *     absent, the unmatched portion is quality "missing" (never silently filled
 *     with the location grid factor, and never coerced to zero emissions while
 *     claiming calculated).
 *   - District heat / steam / cooling (single metric key district_heat_kwh —
 *     steam and cooling are not separate seeded metrics) uses the same
 *     location-based registry factor in both method totals. Contractual
 *     instruments do not apply to heat; there is no heat residual-mix path.
 *   - Instrument kWh in excess of total electricity is clamped; over-claim is
 *     ignored so matched ≤ total kWh.
 *   - Without instruments, 100% of electricity is unmatched → residual mix or missing.
 *
 * When provenance-aware reaggregation feeds both estimate and primary totals,
 * spend_total is omitted so the same supplier is never double-counted.
 *
 * A component is only added when its metric is present (value !== null). Absent
 * components are never treated as zero — they are simply left out of the sum, and
 * the scope's own quality drops to "missing" only when every component is absent
 * (or, for market-based, when any unmatched residual portion cannot be resolved).
 */
import { resolveFactor, tryResolveFactor } from "./resolveFactor";
import { computeWasteCat5 } from "./wasteWater";
import type {
  DatapointValue,
  FactorRecord,
  Measured,
  Quality,
  Scope2ContractualInstrument,
} from "./types";

export const FACTOR_KEYS = {
  grid: "grid_electricity",
  /** Residual mix for market-based Scope 2 unmatched kWh (GHG Protocol). */
  residualMix: "residual_mix",
  /** District heat / steam / cooling (location factor; also folded into market totals). */
  districtHeat: "district_heat",
  diesel: "diesel",
  naturalGas: "natural_gas",
  petrol: "petrol",
  spend: "spend_purchased_goods",
  /** Legacy Cat 6 aggregate (when mode-split metrics are absent). */
  travel: "business_travel_avg",
  travelAirShort: "business_travel_air_short",
  travelAirLong: "business_travel_air_long",
  travelRail: "business_travel_rail",
  travelCar: "business_travel_car",
  travelHotel: "business_travel_hotel",
  commuteCar: "employee_commute_car",
  commutePublic: "employee_commute_public",
  commuteBicycle: "employee_commute_bicycle",
  /** Freight mode factors (kgCO2e/tkm) — shared by Cat 4 upstream and Cat 9 downstream. */
  freightRoad: "freight_road",
  freightRail: "freight_rail",
  freightSea: "freight_sea",
  freightAir: "freight_air",
} as const;

export const METRIC_KEYS = {
  electricity: "electricity_kwh",
  /** Bundled purchased heat, steam, and cooling from a district network. */
  districtHeat: "district_heat_kwh",
  diesel: "diesel_litres",
  naturalGas: "natural_gas_m3",
  petrol: "petrol_litres",
  supplierSpend: "supplier_spend_total",
  /** Pre-rolled spend×factor tCO2e (provenance spend_estimate). Prefer over raw spend. */
  supplierSpendEstimate: "supplier_spend_estimate_tco2e",
  /** Legacy Cat 6 aggregate — used only when no mode-split travel metric is present. */
  businessTravel: "business_travel_km",
  businessTravelAirShort: "business_travel_air_short_km",
  businessTravelAirLong: "business_travel_air_long_km",
  businessTravelRail: "business_travel_rail_km",
  businessTravelCar: "business_travel_car_km",
  businessTravelHotelNights: "business_travel_hotel_nights",
  employeeCommuteCar: "employee_commute_car_km",
  employeeCommutePublic: "employee_commute_public_km",
  employeeCommuteBicycle: "employee_commute_bicycle_km",
  /** Cat 4 upstream freight — tonne-km by mode. */
  freightUpstreamRoad: "freight_upstream_road_tkm",
  freightUpstreamRail: "freight_upstream_rail_tkm",
  freightUpstreamSea: "freight_upstream_sea_tkm",
  freightUpstreamAir: "freight_upstream_air_tkm",
  /** Cat 9 downstream freight — tonne-km by mode. */
  freightDownstreamRoad: "freight_downstream_road_tkm",
  freightDownstreamRail: "freight_downstream_rail_tkm",
  freightDownstreamSea: "freight_downstream_sea_tkm",
  freightDownstreamAir: "freight_downstream_air_tkm",
  supplierReported: "supplier_reported_tco2e",
} as const;

/** Cat 6 mode-split rows (metric → factor). Prefer these over {@link METRIC_KEYS.businessTravel}. */
export const BUSINESS_TRAVEL_MODES = [
  {
    metricKey: METRIC_KEYS.businessTravelAirShort,
    factorKey: FACTOR_KEYS.travelAirShort,
    componentKey: "business_travel_air_short",
    label: "Business travel — air short haul",
  },
  {
    metricKey: METRIC_KEYS.businessTravelAirLong,
    factorKey: FACTOR_KEYS.travelAirLong,
    componentKey: "business_travel_air_long",
    label: "Business travel — air long haul",
  },
  {
    metricKey: METRIC_KEYS.businessTravelRail,
    factorKey: FACTOR_KEYS.travelRail,
    componentKey: "business_travel_rail",
    label: "Business travel — rail",
  },
  {
    metricKey: METRIC_KEYS.businessTravelCar,
    factorKey: FACTOR_KEYS.travelCar,
    componentKey: "business_travel_car",
    label: "Business travel — car",
  },
  {
    metricKey: METRIC_KEYS.businessTravelHotelNights,
    factorKey: FACTOR_KEYS.travelHotel,
    componentKey: "business_travel_hotel",
    label: "Business travel — hotel nights",
  },
] as const;

/** Cat 7 employee commuting mode-split rows. */
export const EMPLOYEE_COMMUTE_MODES = [
  {
    metricKey: METRIC_KEYS.employeeCommuteCar,
    factorKey: FACTOR_KEYS.commuteCar,
    componentKey: "employee_commute_car",
    label: "Employee commute — car",
  },
  {
    metricKey: METRIC_KEYS.employeeCommutePublic,
    factorKey: FACTOR_KEYS.commutePublic,
    componentKey: "employee_commute_public",
    label: "Employee commute — public transport",
  },
  {
    metricKey: METRIC_KEYS.employeeCommuteBicycle,
    factorKey: FACTOR_KEYS.commuteBicycle,
    componentKey: "employee_commute_bicycle",
    label: "Employee commute — bicycle",
  },
] as const;

export const TRAVEL_AND_COMMUTE_METRIC_KEYS = [
  METRIC_KEYS.businessTravel,
  ...BUSINESS_TRAVEL_MODES.map((m) => m.metricKey),
  ...EMPLOYEE_COMMUTE_MODES.map((m) => m.metricKey),
] as const;

/** Cat 4 upstream freight mode × tkm rows. */
export const FREIGHT_UPSTREAM_MODES = [
  {
    metricKey: METRIC_KEYS.freightUpstreamRoad,
    factorKey: FACTOR_KEYS.freightRoad,
    componentKey: "freight_upstream_road",
    label: "Upstream freight — road",
  },
  {
    metricKey: METRIC_KEYS.freightUpstreamRail,
    factorKey: FACTOR_KEYS.freightRail,
    componentKey: "freight_upstream_rail",
    label: "Upstream freight — rail",
  },
  {
    metricKey: METRIC_KEYS.freightUpstreamSea,
    factorKey: FACTOR_KEYS.freightSea,
    componentKey: "freight_upstream_sea",
    label: "Upstream freight — sea",
  },
  {
    metricKey: METRIC_KEYS.freightUpstreamAir,
    factorKey: FACTOR_KEYS.freightAir,
    componentKey: "freight_upstream_air",
    label: "Upstream freight — air",
  },
] as const;

/** Cat 9 downstream freight mode × tkm rows. */
export const FREIGHT_DOWNSTREAM_MODES = [
  {
    metricKey: METRIC_KEYS.freightDownstreamRoad,
    factorKey: FACTOR_KEYS.freightRoad,
    componentKey: "freight_downstream_road",
    label: "Downstream freight — road",
  },
  {
    metricKey: METRIC_KEYS.freightDownstreamRail,
    factorKey: FACTOR_KEYS.freightRail,
    componentKey: "freight_downstream_rail",
    label: "Downstream freight — rail",
  },
  {
    metricKey: METRIC_KEYS.freightDownstreamSea,
    factorKey: FACTOR_KEYS.freightSea,
    componentKey: "freight_downstream_sea",
    label: "Downstream freight — sea",
  },
  {
    metricKey: METRIC_KEYS.freightDownstreamAir,
    factorKey: FACTOR_KEYS.freightAir,
    componentKey: "freight_downstream_air",
    label: "Downstream freight — air",
  },
] as const;

export const FREIGHT_METRIC_KEYS = [
  ...FREIGHT_UPSTREAM_MODES.map((m) => m.metricKey),
  ...FREIGHT_DOWNSTREAM_MODES.map((m) => m.metricKey),
] as const;

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

/**
 * Scope 2 dual result. `measured` / `components` / `missingInputs` mirror the
 * location-based path so existing callers of ScopeComputation stay valid.
 */
export interface Scope2Computation extends ScopeComputation {
  locationBased: Measured;
  marketBased: Measured;
  locationComponents: EmissionComponent[];
  marketComponents: EmissionComponent[];
  locationMissingInputs: string[];
  marketMissingInputs: string[];
}

function tco2eFrom(quantity: number, factor: FactorRecord): number {
  return (quantity * factor.value) / 1000;
}

function summarise(
  components: EmissionComponent[],
  opts?: { forceMissing?: boolean },
): Measured {
  if (components.length === 0 || opts?.forceMissing) {
    const value = components.reduce((sum, c) => sum + c.valueTco2e, 0);
    return { value, unit: "tCO2e", quality: "missing" };
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

function isMetricPresent(metrics: Record<string, DatapointValue>, key: string): boolean {
  const dp = metric(metrics, key);
  return dp !== undefined && dp.value !== null;
}

function pushQuantityComponent(
  components: EmissionComponent[],
  missingInputs: string[],
  metrics: Record<string, DatapointValue>,
  opts: {
    metricKey: string;
    factorKey: string;
    componentKey: string;
    label: string;
    factors: FactorRecord[];
    region: string;
    year: number;
  },
): void {
  const dp = metric(metrics, opts.metricKey);
  if (dp && dp.value !== null) {
    const factor = resolveFactor(opts.factors, opts.factorKey, opts.region, opts.year);
    components.push({
      key: opts.componentKey,
      label: opts.label,
      valueTco2e: tco2eFrom(dp.value, factor),
      factor,
    });
  } else {
    missingInputs.push(opts.metricKey);
  }
}

/**
 * Cat 6 business travel + Cat 7 employee commuting.
 * Mode-split travel wins over legacy business_travel_km (no double-count).
 * Absent metrics are quality-missing via missingInputs — never silent zero.
 */
export function computeTravelAndCommute(
  metrics: Record<string, DatapointValue>,
  factors: FactorRecord[],
  region: string,
  year: number,
): ScopeComputation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];

  const anyTravelMode = BUSINESS_TRAVEL_MODES.some((mode) =>
    isMetricPresent(metrics, mode.metricKey),
  );

  if (anyTravelMode) {
    for (const mode of BUSINESS_TRAVEL_MODES) {
      pushQuantityComponent(components, missingInputs, metrics, {
        metricKey: mode.metricKey,
        factorKey: mode.factorKey,
        componentKey: mode.componentKey,
        label: mode.label,
        factors,
        region,
        year,
      });
    }
  } else {
    pushQuantityComponent(components, missingInputs, metrics, {
      metricKey: METRIC_KEYS.businessTravel,
      factorKey: FACTOR_KEYS.travel,
      componentKey: "business_travel",
      label: "Business travel",
      factors,
      region,
      year,
    });
  }

  for (const mode of EMPLOYEE_COMMUTE_MODES) {
    pushQuantityComponent(components, missingInputs, metrics, {
      metricKey: mode.metricKey,
      factorKey: mode.factorKey,
      componentKey: mode.componentKey,
      label: mode.label,
      factors,
      region,
      year,
    });
  }

  return { measured: summarise(components), components, missingInputs };
}

/**
 * Cat 4 upstream + Cat 9 downstream freight (mode × tonne-km).
 * Absent metrics are listed in missingInputs — never silent zero.
 * Mode factors are shared; category is encoded in the metric / component key.
 */
export function computeFreight(
  metrics: Record<string, DatapointValue>,
  factors: FactorRecord[],
  region: string,
  year: number,
): ScopeComputation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];

  for (const mode of FREIGHT_UPSTREAM_MODES) {
    pushQuantityComponent(components, missingInputs, metrics, {
      metricKey: mode.metricKey,
      factorKey: mode.factorKey,
      componentKey: mode.componentKey,
      label: mode.label,
      factors,
      region,
      year,
    });
  }

  for (const mode of FREIGHT_DOWNSTREAM_MODES) {
    pushQuantityComponent(components, missingInputs, metrics, {
      metricKey: mode.metricKey,
      factorKey: mode.factorKey,
      componentKey: mode.componentKey,
      label: mode.label,
      factors,
      region,
      year,
    });
  }

  return { measured: summarise(components), components, missingInputs };
}

function instrumentFactor(
  instrument: Scope2ContractualInstrument,
  year: number,
  index: number,
): FactorRecord {
  return {
    id: instrument.factorId ?? `scope2-instrument-${index}`,
    key: "contractual_instrument",
    value: instrument.factorKgPerKwh,
    unit: "kgCO2e/kWh",
    source: instrument.label ?? "contractual_instrument",
    publicationYear: year,
    region: "CONTRACT",
  };
}

/**
 * Market-based Scope 2 for purchased electricity.
 *
 * Assumptions (documented for REC agent / auditors):
 * 1. Instruments cover electricity only. District heat is added separately by
 *    computeScope2 using the location-based district_heat factor (no heat
 *    instruments / residual mix in this product).
 * 2. Factors are kgCO2e/kWh supplied by the caller (certificate / supplier rate).
 * 3. Over-matched instruments are clamped to total electricity kWh.
 * 4. Unmatched kWh requires residual_mix in the factor registry; no silent
 *    fallback to the location-based grid factor.
 */
function computeMarketBasedElectricity(
  electricityKwh: number,
  factors: FactorRecord[],
  region: string,
  year: number,
  instruments: Scope2ContractualInstrument[],
): ScopeComputation {
  const components: EmissionComponent[] = [];
  const missingInputs: string[] = [];

  let remaining = electricityKwh;
  let matched = 0;

  instruments.forEach((instrument, index) => {
    if (remaining <= 0) return;
    if (!(instrument.kWh > 0) || !(instrument.factorKgPerKwh >= 0)) return;
    const appliedKwh = Math.min(instrument.kWh, remaining);
    remaining -= appliedKwh;
    matched += appliedKwh;
    const factor = instrumentFactor(instrument, year, index);
    components.push({
      key: `instrument_${index}`,
      label: instrument.label ?? `Contractual instrument ${index + 1}`,
      valueTco2e: tco2eFrom(appliedKwh, factor),
      factor,
    });
  });

  const unmatched = electricityKwh - matched;
  let unmatchedMissing = false;

  if (unmatched > 0) {
    const residual = tryResolveFactor(factors, FACTOR_KEYS.residualMix, region, year);
    if (residual) {
      components.push({
        key: "residual_mix",
        label: "Residual mix",
        valueTco2e: tco2eFrom(unmatched, residual),
        factor: residual,
      });
    } else {
      // Unmatched portion cannot be calculated — quality missing, not silent zero.
      unmatchedMissing = true;
      missingInputs.push(FACTOR_KEYS.residualMix);
    }
  }

  if (instruments.length === 0 && unmatchedMissing) {
    missingInputs.push("scope2_contractual_instruments");
  }

  return {
    measured: summarise(components, { forceMissing: unmatchedMissing }),
    components,
    missingInputs,
  };
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
  instruments: Scope2ContractualInstrument[] = [],
): Scope2Computation {
  const locationComponents: EmissionComponent[] = [];
  const locationMissingInputs: string[] = [];
  const marketComponents: EmissionComponent[] = [];
  const marketMissingInputs: string[] = [];

  const electricity = metric(metrics, METRIC_KEYS.electricity);
  /** True when electricity market path could not resolve unmatched residual mix. */
  let marketElectricityIncomplete = false;

  if (electricity && electricity.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.grid, region, year);
    locationComponents.push({
      key: "electricity",
      label: "Grid electricity (location-based)",
      valueTco2e: tco2eFrom(electricity.value, factor),
      factor,
    });
    const marketElectricity = computeMarketBasedElectricity(
      electricity.value,
      factors,
      region,
      year,
      instruments,
    );
    marketComponents.push(...marketElectricity.components);
    marketMissingInputs.push(...marketElectricity.missingInputs);
    marketElectricityIncomplete = marketElectricity.measured.quality === "missing";
  } else {
    locationMissingInputs.push(METRIC_KEYS.electricity);
    marketMissingInputs.push(METRIC_KEYS.electricity);
  }

  // District heat / steam / cooling — location factor in both method totals.
  const heat = metric(metrics, METRIC_KEYS.districtHeat);
  if (heat && heat.value !== null) {
    const factor = resolveFactor(factors, FACTOR_KEYS.districtHeat, region, year);
    const heatComponent: EmissionComponent = {
      key: "district_heat",
      label: "District heat / steam / cooling",
      valueTco2e: tco2eFrom(heat.value, factor),
      factor,
    };
    locationComponents.push(heatComponent);
    marketComponents.push(heatComponent);
  } else {
    locationMissingInputs.push(METRIC_KEYS.districtHeat);
    marketMissingInputs.push(METRIC_KEYS.districtHeat);
  }

  const locationMeasured = summarise(locationComponents);
  const marketMeasured = summarise(marketComponents, {
    forceMissing: marketElectricityIncomplete,
  });

  return {
    measured: locationMeasured,
    components: locationComponents,
    missingInputs: locationMissingInputs,
    locationBased: locationMeasured,
    marketBased: marketMeasured,
    locationComponents,
    marketComponents,
    locationMissingInputs,
    marketMissingInputs,
  };
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

  const travelAndCommute = computeTravelAndCommute(metrics, factors, region, year);
  components.push(...travelAndCommute.components);
  missingInputs.push(...travelAndCommute.missingInputs);

  const freight = computeFreight(metrics, factors, region, year);
  components.push(...freight.components);
  missingInputs.push(...freight.missingInputs);

  // Cat 5 — only when disposal metrics + seeded factors both resolve (no force).
  const wasteCat5 = computeWasteCat5(metrics, factors, region, year);
  components.push(...wasteCat5.components);
  // Do not fold waste missingInputs into Scope 3 totals: water/waste are
  // operational E metrics; absent disposal routes must not dilute Cat 1–7 gaps.

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
