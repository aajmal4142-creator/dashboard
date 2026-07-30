/**
 * Pure product-level (SKU) footprint math. Zero I/O — all quantities and factors
 * are injected. Missing factor → throw (never silent default).
 */

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

export type SkuFootprintResult = {
  sku: string;
  productName: string;
  totalCarbonFootprint: number; // kg CO2e per unit
  breakdown: {
    materials: number;
    production: number;
    packaging: number;
    transportation: number;
    endOfLife: number;
  };
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

export function calculateSKUFootprint(input: SkuCalcInput): SkuFootprintResult {
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

  return {
    sku: input.sku,
    productName: input.productName,
    totalCarbonFootprint: round2(totalCarbonFootprint),
    breakdown: {
      materials: round2(materials),
      production: round2(production),
      packaging: round2(packaging),
      transportation: round2(transportation),
      endOfLife: round2(endOfLife),
    },
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
