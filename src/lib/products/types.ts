import type { Quality } from "@/lib/calc/types";

export const PRODUCT_FOOTPRINT_STATUSES = [
  "draft",
  "published",
  "verified",
  "superseded",
] as const;

export type ProductFootprintStatus = (typeof PRODUCT_FOOTPRINT_STATUSES)[number];

export const PRODUCT_FOOTPRINT_UNITS = [
  "per_unit",
  "per_kg",
  "per_liter",
  "per_service",
] as const;

export type ProductFootprintUnit = (typeof PRODUCT_FOOTPRINT_UNITS)[number];

export const PRODUCT_TRANSPORT_MODES = ["ocean", "air", "truck", "rail"] as const;

export type ProductTransportMode = (typeof PRODUCT_TRANSPORT_MODES)[number];

export const PRODUCT_QUALITY_VALUES = [
  "measured",
  "calculated",
  "estimated",
  "missing",
] as const;

export type ProductFootprintQuality = (typeof PRODUCT_QUALITY_VALUES)[number];

export type BomLineDto = {
  id: string | null;
  material: string;
  quantity: number;
  unit: string;
  supplierEmissionFactor: number | null;
  factorSource: "supplier" | "industry" | "custom" | null;
  materialCarbonFootprint: number | null;
};

export type EmissionsSourceDto = {
  id: string | null;
  source: string;
  quantity: number;
  unit: string;
  emissionsFactor: number;
  totalEmissions: number | null;
};

export type StageBreakdownDto = {
  materials: number;
  production: number;
  packaging: number;
  transportation: number;
  endOfLife: number;
};

export type ProductFootprintDto = {
  id: string;
  productName: string;
  sku: string;
  category: string;
  description: string | null;
  unit: ProductFootprintUnit;
  periodId: string | null;
  periodLabel: string | null;
  status: ProductFootprintStatus;
  quality: ProductFootprintQuality;
  /** kg CO2e per unit — null until calculated */
  totalCarbonFootprintKg: number | null;
  /** tCO2e per unit — null until calculated */
  totalTco2e: number | null;
  breakdown: StageBreakdownDto | null;
  billOfMaterials: BomLineDto[];
  emissionsSources: EmissionsSourceDto[];
  primaryPackaging: string | null;
  primaryWeight: number | null;
  secondaryPackaging: string | null;
  secondaryWeight: number | null;
  totalPackagingEmissions: number | null;
  transportOrigin: string | null;
  transportDestination: string | null;
  transportDistance: number | null;
  transportMode: ProductTransportMode | null;
  transportEmissionsFactor: number | null;
  transportUnitsShipped: number | null;
  emissionsFromDecomposition: number | null;
  recyclingBenefit: number | null;
  lastCalculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PeriodOption = {
  id: string;
  label: string;
  status: string;
};

export function isProductFootprintStatus(
  value: unknown,
): value is ProductFootprintStatus {
  return (
    typeof value === "string" &&
    (PRODUCT_FOOTPRINT_STATUSES as readonly string[]).includes(value)
  );
}

export function isProductFootprintUnit(value: unknown): value is ProductFootprintUnit {
  return (
    typeof value === "string" &&
    (PRODUCT_FOOTPRINT_UNITS as readonly string[]).includes(value)
  );
}

export function isProductTransportMode(value: unknown): value is ProductTransportMode {
  return (
    typeof value === "string" &&
    (PRODUCT_TRANSPORT_MODES as readonly string[]).includes(value)
  );
}

export function isProductFootprintQuality(
  value: unknown,
): value is ProductFootprintQuality {
  return (
    typeof value === "string" &&
    (PRODUCT_QUALITY_VALUES as readonly string[]).includes(value)
  );
}

export function qualityFromStored(value: unknown): ProductFootprintQuality {
  if (isProductFootprintQuality(value)) return value;
  return "missing";
}

export function toQuality(value: Quality): ProductFootprintQuality {
  return value;
}
