import { getPayload } from "payload";
import config from "@/payload.config";
import type { ProductLevelFootprinting } from "@/payload-types";

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

type BomMaterial = NonNullable<ProductLevelFootprinting["billOfMaterials"]>[number];
type EmissionsSource = NonNullable<ProductLevelFootprinting["emissionsSources"]>[number];

export async function calculateSKUFootprint(skuId: string): Promise<SkuFootprintResult> {
  const payload = await getPayload({ config });

  const sku = await payload.findByID({
    collection: "product-level-footprinting",
    id: skuId,
  });

  if (!sku) throw new Error(`SKU not found: ${skuId}`);

  // Calculate each lifecycle stage
  const materialsEmissions = calculateMaterialsEmissions(sku);
  const productionEmissions = calculateProductionEmissions(sku);
  const packagingEmissions = calculatePackagingEmissions(sku);
  const transportationEmissions = calculateTransportationEmissions(sku);
  const endOfLifeEmissions = calculateEndOfLifeEmissions(sku);

  const totalCarbonFootprint =
    materialsEmissions +
    productionEmissions +
    packagingEmissions +
    transportationEmissions +
    endOfLifeEmissions;

  return {
    sku: sku.sku,
    productName: sku.productName,
    totalCarbonFootprint: Math.round(totalCarbonFootprint * 100) / 100,
    breakdown: {
      materials: Math.round(materialsEmissions * 100) / 100,
      production: Math.round(productionEmissions * 100) / 100,
      packaging: Math.round(packagingEmissions * 100) / 100,
      transportation: Math.round(transportationEmissions * 100) / 100,
      endOfLife: Math.round(endOfLifeEmissions * 100) / 100,
    },
    confidence: "medium",
  };
}

function calculateMaterialsEmissions(sku: ProductLevelFootprinting): number {
  const bom: BomMaterial[] = sku.billOfMaterials ?? [];
  let totalEmissions = 0;

  for (const material of bom) {
    const emissionsFactor = material.supplierEmissionFactor ?? 2.5; // Default factor
    const materialEmissions = material.quantity * emissionsFactor;
    totalEmissions += materialEmissions;
  }

  return totalEmissions;
}

function calculateProductionEmissions(sku: ProductLevelFootprinting): number {
  const sources: EmissionsSource[] = sku.emissionsSources ?? [];
  if (sources.length === 0) return 0;

  let total = 0;
  for (const source of sources) {
    total += source.quantity * source.emissionsFactor;
  }

  return total;
}

function calculatePackagingEmissions(sku: ProductLevelFootprinting): number {
  const primaryEmissions = (sku.primaryWeight ?? 0) * 2.0; // 2 kg CO2e per kg plastic
  const secondaryEmissions = (sku.secondaryWeight ?? 0) * 2.0;

  return primaryEmissions + secondaryEmissions;
}

function calculateTransportationEmissions(sku: ProductLevelFootprinting): number {
  const distance = sku.transportDistance ?? 0;
  const unitsShipped = sku.transportUnitsShipped ?? 1;

  // Simplified factor: 0.1 kg CO2e per km per unit
  // Adjust based on transport mode
  const modeFactor =
    {
      ocean: 0.01,
      air: 0.5,
      truck: 0.15,
      rail: 0.05,
    }[sku.transportMode ?? "truck"] ?? 0.1;

  const emissionsPerUnit = (distance * modeFactor) / unitsShipped;
  return emissionsPerUnit;
}

function calculateEndOfLifeEmissions(sku: ProductLevelFootprinting): number {
  const decompositionEmissions = sku.emissionsFromDecomposition ?? 0;
  const recyclingBenefit = sku.recyclingBenefit ?? 0;

  return Math.max(0, decompositionEmissions + recyclingBenefit);
}

export async function calculateBOMRollup(parentSkuId: string): Promise<number> {
  const payload = await getPayload({ config });

  const parentSku = await payload.findByID({
    collection: "product-level-footprinting",
    id: parentSkuId,
  });

  if (!parentSku) throw new Error(`SKU not found: ${parentSkuId}`);

  const bom: BomMaterial[] = parentSku.billOfMaterials ?? [];
  let totalEmissions = 0;

  for (const material of bom) {
    try {
      // Try to find child SKU
      const childSkus = await payload.find({
        collection: "product-level-footprinting",
        where: {
          sku: { equals: material.material },
        },
        limit: 1,
      });

      if (childSkus.docs?.[0]) {
        const childFootprint = await calculateSKUFootprint(childSkus.docs[0].id);
        const materialEmissions = material.quantity * childFootprint.totalCarbonFootprint;
        totalEmissions += materialEmissions;
      } else {
        // No SKU found, use direct factor
        const emissionsFactor = material.supplierEmissionFactor ?? 2.5;
        totalEmissions += material.quantity * emissionsFactor;
      }
    } catch (error) {
      console.error(
        `Error calculating emissions for material ${material.material}:`,
        error,
      );
    }
  }

  return totalEmissions;
}

export async function updateSKUFootprint(skuId: string): Promise<SkuFootprintResult> {
  const result = await calculateSKUFootprint(skuId);
  const payload = await getPayload({ config });

  await payload.update({
    collection: "product-level-footprinting",
    id: skuId,
    data: {
      totalCarbonFootprint: result.totalCarbonFootprint,
      breakdownByStage: result.breakdown,
      lastCalculatedAt: new Date().toISOString(),
    },
  });

  return result;
}
