/**
 * Pure product-level (SKU) footprint math. Zero I/O — all quantities and factors
 * are injected. Missing factor → throw (never silent default).
 * Empty activity → quality "missing" (never silent zero as measured).
 */

import type { Quality } from "./types";

export type SkuMaterialLine = {
  material: string;
  quantity: number;
  /** kg CO2e per quantity unit — required; no default. */
  emissionFactor: number;
};

export type SkuEmissionsSourceLine = {
  quantity: number;
  emissionsFactor: number;
};

export type SkuCalcInput = {
  sku: string;
  productName: string;
  billOfMaterials: SkuMaterialLine[];
  emissionsSources: SkuEmissionsSourceLine[];
  primaryWeight: number;
  secondaryWeight: number;
  /**
   * Prefer precomputed packaging stage kg CO2e when set.
   * Otherwise mass × packagingFactorKgCo2ePerKg (factor required if mass > 0).
   */
  packagingEmissionsPrecomputed: number | null;
  packagingFactorKgCo2ePerKg: number | null;
  transportDistance: number;
  transportUnitsShipped: number;
  /** kg CO2e per km per unit — required when transportDistance > 0. */
  transportModeFactor: number | null;
  emissionsFromDecomposition: number;
  recyclingBenefit: number;
};

export type SkuStageBreakdown = {
  materials: number;
  production: number;
  packaging: number;
  transportation: number;
  endOfLife: number;
};

export type SkuFootprintResult = {
  sku: string;
  productName: string;
  /** kg CO2e per unit */
  totalCarbonFootprint: number;
  /** tCO2e per unit (kg / 1000) */
  totalTco2e: number;
  breakdown: SkuStageBreakdown;
  quality: Quality;
  confidence: "low" | "medium" | "high";
};

export type BomRollupLine = {
  material: string;
  quantity: number;
  /** Prefer child SKU footprint per unit when present. */
  childFootprintPerUnit: number | null;
  /** Direct factor when no child SKU — required if childFootprintPerUnit is null. */
  emissionFactor: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Convert kg CO2e to tCO2e. */
export function kgCo2eToTco2e(kg: number): number {
  return round6(kg / 1000);
}

/**
 * True when the input carries any activity that can produce a footprint.
 * Empty cradle-to-grave → quality missing (do not treat as measured zero).
 */
export function skuInputHasActivity(input: SkuCalcInput): boolean {
  if (input.billOfMaterials.length > 0) return true;
  if (input.emissionsSources.length > 0) return true;
  if (input.primaryWeight + input.secondaryWeight > 0) return true;
  if (
    input.packagingEmissionsPrecomputed !== null &&
    Number.isFinite(input.packagingEmissionsPrecomputed) &&
    input.packagingEmissionsPrecomputed !== 0
  ) {
    return true;
  }
  if (input.transportDistance > 0) return true;
  if (input.emissionsFromDecomposition !== 0) return true;
  if (input.recyclingBenefit !== 0) return true;
  return false;
}

function calculateMaterialsEmissions(lines: SkuMaterialLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (!Number.isFinite(line.emissionFactor)) {
      throw new Error(`Missing emissions factor for material: ${line.material}`);
    }
    total += line.quantity * line.emissionFactor;
  }
  return total;
}

function calculateProductionEmissions(sources: SkuEmissionsSourceLine[]): number {
  let total = 0;
  for (const source of sources) {
    if (!Number.isFinite(source.emissionsFactor)) {
      throw new Error("Missing emissions factor on production source line");
    }
    total += source.quantity * source.emissionsFactor;
  }
  return total;
}

function calculatePackagingEmissions(
  primaryWeight: number,
  secondaryWeight: number,
  precomputed: number | null,
  factor: number | null,
): number {
  if (precomputed !== null && Number.isFinite(precomputed)) {
    return Math.max(0, precomputed);
  }
  const mass = primaryWeight + secondaryWeight;
  if (mass <= 0) return 0;
  if (factor === null || !Number.isFinite(factor)) {
    throw new Error("Missing packaging emissions factor (kg CO2e per kg)");
  }
  return mass * factor;
}

function calculateTransportationEmissions(
  distance: number,
  unitsShipped: number,
  modeFactor: number | null,
): number {
  if (distance <= 0) return 0;
  if (modeFactor === null || !Number.isFinite(modeFactor)) {
    throw new Error("Missing transport mode emissions factor");
  }
  const units = unitsShipped > 0 ? unitsShipped : 1;
  return (distance * modeFactor) / units;
}

function calculateEndOfLifeEmissions(
  emissionsFromDecomposition: number,
  recyclingBenefit: number,
): number {
  return Math.max(0, emissionsFromDecomposition + recyclingBenefit);
}

function emptyBreakdown(): SkuStageBreakdown {
  return {
    materials: 0,
    production: 0,
    packaging: 0,
    transportation: 0,
    endOfLife: 0,
  };
}

export function calculateSKUFootprint(input: SkuCalcInput): SkuFootprintResult {
  if (!skuInputHasActivity(input)) {
    return {
      sku: input.sku,
      productName: input.productName,
      totalCarbonFootprint: 0,
      totalTco2e: 0,
      breakdown: emptyBreakdown(),
      quality: "missing",
      confidence: "low",
    };
  }

  const materials = calculateMaterialsEmissions(input.billOfMaterials);
  const production = calculateProductionEmissions(input.emissionsSources);
  const packaging = calculatePackagingEmissions(
    input.primaryWeight,
    input.secondaryWeight,
    input.packagingEmissionsPrecomputed,
    input.packagingFactorKgCo2ePerKg,
  );
  const transportation = calculateTransportationEmissions(
    input.transportDistance,
    input.transportUnitsShipped,
    input.transportModeFactor,
  );
  const endOfLife = calculateEndOfLifeEmissions(
    input.emissionsFromDecomposition,
    input.recyclingBenefit,
  );

  const totalCarbonFootprint =
    materials + production + packaging + transportation + endOfLife;
  const rounded = round2(totalCarbonFootprint);

  return {
    sku: input.sku,
    productName: input.productName,
    totalCarbonFootprint: rounded,
    totalTco2e: kgCo2eToTco2e(rounded),
    breakdown: {
      materials: round2(materials),
      production: round2(production),
      packaging: round2(packaging),
      transportation: round2(transportation),
      endOfLife: round2(endOfLife),
    },
    quality: "calculated",
    confidence: "medium",
  };
}

/**
 * Roll up BOM: quantity × (child footprint or direct factor). Throws if a line
 * has neither.
 */
export function calculateBOMRollup(lines: BomRollupLine[]): number {
  let total = 0;

  for (const line of lines) {
    if (
      line.childFootprintPerUnit !== null &&
      Number.isFinite(line.childFootprintPerUnit)
    ) {
      total += line.quantity * line.childFootprintPerUnit;
      continue;
    }
    if (line.emissionFactor !== null && Number.isFinite(line.emissionFactor)) {
      total += line.quantity * line.emissionFactor;
      continue;
    }
    throw new Error(`Missing emissions factor for BOM material: ${line.material}`);
  }

  return round2(total);
}
