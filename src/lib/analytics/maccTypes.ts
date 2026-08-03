/**
 * Pure MACC / abatement ROI types. Zero I/O. No Next/Payload imports.
 *
 * Cost/tCO₂e uses straight-line CAPEX amortisation (no discount rate):
 *   annualisedCost = capex / lifetimeYears + opexPerYear
 *   costPerTco2e   = annualisedCost / annualAbatementTco2e
 *
 * Missing costs or abatement are never coerced to zero — quality is "missing".
 */

export type MaccQuality = "measured" | "missing";

export type AbatementLeverCategory =
  | "energy_efficiency"
  | "renewable_electricity"
  | "process_fuel"
  | "fleet_transport"
  | "nature_offsets"
  | "other";

export type AbatementLeverInput = {
  id: string;
  name: string;
  category: AbatementLeverCategory | null;
  annualAbatementTco2e: number | null;
  capex: number | null;
  opexPerYear: number | null;
  lifetimeYears: number | null;
};

export type LeverCostResult = {
  id: string;
  name: string;
  category: AbatementLeverCategory | null;
  annualAbatementTco2e: number | null;
  capex: number | null;
  opexPerYear: number | null;
  lifetimeYears: number | null;
  /** CAPEX / lifetime + OPEX when all inputs are valid. */
  annualisedCost: number | null;
  /** Annualised cost ÷ annual abatement (currency / tCO₂e). */
  costPerTco2e: number | null;
  lifetimeCost: number | null;
  lifetimeAbatementTco2e: number | null;
  quality: MaccQuality;
  message: string | null;
};

export type MaccCurvePoint = {
  id: string;
  name: string;
  category: AbatementLeverCategory | null;
  /** Cumulative abatement before this bar (tCO₂e/year). */
  abatementStart: number;
  /** Cumulative abatement after this bar (tCO₂e/year). */
  abatementEnd: number;
  annualAbatementTco2e: number;
  costPerTco2e: number;
  annualisedCost: number;
};

export type LeverRoiResult = {
  id: string;
  /** (lifetime abatement value − lifetime cost) / lifetime cost. */
  lifetimeRoi: number | null;
  /** CAPEX / (annualAbatement × carbonPrice − OPEX) when denominator > 0. */
  paybackYears: number | null;
  annualNetBenefit: number | null;
  lifetimeNetBenefit: number | null;
  quality: MaccQuality;
  message: string | null;
};

export type MaccBuildResult = {
  levers: LeverCostResult[];
  /** Measured levers only, ascending cost/tCO₂e. */
  ranked: LeverCostResult[];
  curve: MaccCurvePoint[];
  totalAnnualAbatementTco2e: number | null;
  totalAnnualisedCost: number | null;
  /** Volume-weighted average cost/tCO₂e across measured levers. */
  weightedAverageCostPerTco2e: number | null;
  measuredCount: number;
  missingCount: number;
  quality: MaccQuality;
  message: string | null;
  roi: LeverRoiResult[] | null;
};
