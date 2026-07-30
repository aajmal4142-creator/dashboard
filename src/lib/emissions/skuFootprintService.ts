import { getPayload } from "payload";
import config from "@/payload.config";
import type { ProductLevelFootprinting } from "@/payload-types";
import {
  calculateBOMRollup,
  calculateSKUFootprint,
  type SkuCalcInput,
  type SkuFootprintResult,
} from "@/lib/calc/skuFootprint";

type BomMaterial = NonNullable<ProductLevelFootprinting["billOfMaterials"]>[number];
type EmissionsSource = NonNullable<ProductLevelFootprinting["emissionsSources"]>[number];

/**
 * Interim transport-mode factor table (kg CO2e per km per unit).
 * Residual (post-F3): still not in EmissionFactors registry — move when transport
 * mode keys are productised. Core Scope 1/2/3 factors are registry-only via F3.
 */
const TRANSPORT_MODE_FACTORS: Record<string, number> = {
  ocean: 0.01,
  air: 0.5,
  truck: 0.15,
  rail: 0.05,
};

export function toSkuCalcInput(
  sku: ProductLevelFootprinting,
  packagingFactorKgCo2ePerKg: number | null,
  transportModeFactor: number | null,
): SkuCalcInput {
  const bom: BomMaterial[] = sku.billOfMaterials ?? [];
  const sources: EmissionsSource[] = sku.emissionsSources ?? [];

  return {
    sku: sku.sku,
    productName: sku.productName,
    billOfMaterials: bom.map((material) => {
      if (
        material.supplierEmissionFactor === null ||
        material.supplierEmissionFactor === undefined ||
        !Number.isFinite(material.supplierEmissionFactor)
      ) {
        throw new Error(`Missing emissions factor for material: ${material.material}`);
      }
      return {
        material: material.material,
        quantity: material.quantity,
        emissionFactor: material.supplierEmissionFactor,
      };
    }),
    emissionsSources: sources.map((source) => ({
      quantity: source.quantity,
      emissionsFactor: source.emissionsFactor,
    })),
    primaryWeight: sku.primaryWeight ?? 0,
    secondaryWeight: sku.secondaryWeight ?? 0,
    packagingEmissionsPrecomputed:
      typeof sku.totalPackagingEmissions === "number" &&
      Number.isFinite(sku.totalPackagingEmissions)
        ? sku.totalPackagingEmissions
        : null,
    packagingFactorKgCo2ePerKg,
    transportDistance: sku.transportDistance ?? 0,
    transportUnitsShipped: sku.transportUnitsShipped ?? 1,
    transportModeFactor,
    emissionsFromDecomposition: sku.emissionsFromDecomposition ?? 0,
    recyclingBenefit: sku.recyclingBenefit ?? 0,
  };
}

function resolveTransportModeFactor(
  mode: ProductLevelFootprinting["transportMode"],
  distance: number,
): number | null {
  if (distance <= 0) return null;
  const key = mode ?? "truck";
  const factor = TRANSPORT_MODE_FACTORS[key];
  if (factor === undefined) {
    throw new Error(`Unknown transport mode: ${String(mode)}`);
  }
  return factor;
}

function resolvePackagingFactor(sku: ProductLevelFootprinting): number | null {
  const mass = (sku.primaryWeight ?? 0) + (sku.secondaryWeight ?? 0);
  if (mass <= 0) return null;
  if (
    typeof sku.totalPackagingEmissions === "number" &&
    Number.isFinite(sku.totalPackagingEmissions)
  ) {
    return null;
  }
  throw new Error(
    `Missing packaging emissions for SKU ${sku.sku}: set totalPackagingEmissions or remove packaging weights`,
  );
}

export async function loadSkuById(skuId: string): Promise<ProductLevelFootprinting> {
  const payload = await getPayload({ config });
  const sku = await payload.findByID({
    collection: "product-level-footprinting",
    id: skuId,
  });
  if (!sku) throw new Error(`SKU not found: ${skuId}`);
  return sku;
}

export async function calculateSKUFootprintById(
  skuId: string,
): Promise<SkuFootprintResult> {
  const sku = await loadSkuById(skuId);
  const packagingFactor = resolvePackagingFactor(sku);
  const transportFactor = resolveTransportModeFactor(
    sku.transportMode,
    sku.transportDistance ?? 0,
  );
  return calculateSKUFootprint(toSkuCalcInput(sku, packagingFactor, transportFactor));
}

export async function calculateBOMRollupById(parentSkuId: string): Promise<number> {
  const payload = await getPayload({ config });
  const parentSku = await loadSkuById(parentSkuId);
  const bom: BomMaterial[] = parentSku.billOfMaterials ?? [];

  const lines = [];
  for (const material of bom) {
    const childSkus = await payload.find({
      collection: "product-level-footprinting",
      where: { sku: { equals: material.material } },
      limit: 1,
    });

    if (childSkus.docs?.[0]) {
      const childFootprint = await calculateSKUFootprintById(childSkus.docs[0].id);
      lines.push({
        material: material.material,
        quantity: material.quantity,
        childFootprintPerUnit: childFootprint.totalCarbonFootprint,
        emissionFactor: null as number | null,
      });
    } else {
      const factor =
        material.supplierEmissionFactor !== null &&
        material.supplierEmissionFactor !== undefined &&
        Number.isFinite(material.supplierEmissionFactor)
          ? material.supplierEmissionFactor
          : null;
      lines.push({
        material: material.material,
        quantity: material.quantity,
        childFootprintPerUnit: null as number | null,
        emissionFactor: factor,
      });
    }
  }

  return calculateBOMRollup(lines);
}

export async function updateSKUFootprint(skuId: string): Promise<SkuFootprintResult> {
  const result = await calculateSKUFootprintById(skuId);
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
