import {
  isProductFootprintStatus,
  isProductFootprintUnit,
  isProductTransportMode,
  type BomLineDto,
  type EmissionsSourceDto,
  type ProductFootprintStatus,
  type ProductFootprintUnit,
  type ProductTransportMode,
} from "./types";

export type ProductFootprintWriteInput = {
  productName: string;
  sku: string;
  category: string;
  description: string | null;
  unit: ProductFootprintUnit;
  periodId: string | null;
  status: ProductFootprintStatus;
  billOfMaterials: Array<{
    material: string;
    quantity: number;
    unit: string;
    supplierEmissionFactor: number | null;
    factorSource: "supplier" | "industry" | "custom" | null;
  }>;
  emissionsSources: Array<{
    source: string;
    quantity: number;
    unit: string;
    emissionsFactor: number;
  }>;
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
};

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function optionalNonNegNumber(
  value: unknown,
  field: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `${field} must be a non-negative number` };
  }
  return { ok: true, value: n };
}

function parseBom(
  value: unknown,
):
  | { ok: true; value: ProductFootprintWriteInput["billOfMaterials"] }
  | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "billOfMaterials must be an array" };
  }
  const lines: ProductFootprintWriteInput["billOfMaterials"] = [];
  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `billOfMaterials[${i}] must be an object` };
    }
    const item = row as Record<string, unknown>;
    const material = optionalString(item.material);
    const unit = optionalString(item.unit);
    const quantityRaw = optionalNonNegNumber(
      item.quantity,
      `billOfMaterials[${i}].quantity`,
    );
    if (!quantityRaw.ok) return quantityRaw;
    if (!material) {
      return { ok: false, error: `billOfMaterials[${i}].material is required` };
    }
    if (quantityRaw.value === null) {
      return { ok: false, error: `billOfMaterials[${i}].quantity is required` };
    }
    if (!unit) {
      return { ok: false, error: `billOfMaterials[${i}].unit is required` };
    }
    const factorRaw = optionalNonNegNumber(
      item.supplierEmissionFactor,
      `billOfMaterials[${i}].supplierEmissionFactor`,
    );
    if (!factorRaw.ok) return factorRaw;
    let factorSource: "supplier" | "industry" | "custom" | null = null;
    if (
      item.factorSource === "supplier" ||
      item.factorSource === "industry" ||
      item.factorSource === "custom"
    ) {
      factorSource = item.factorSource;
    } else if (
      item.factorSource !== undefined &&
      item.factorSource !== null &&
      item.factorSource !== ""
    ) {
      return {
        ok: false,
        error: `billOfMaterials[${i}].factorSource must be supplier, industry, or custom`,
      };
    }
    lines.push({
      material,
      quantity: quantityRaw.value,
      unit,
      supplierEmissionFactor: factorRaw.value,
      factorSource,
    });
  }
  return { ok: true, value: lines };
}

function parseSources(
  value: unknown,
):
  | { ok: true; value: ProductFootprintWriteInput["emissionsSources"] }
  | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "emissionsSources must be an array" };
  }
  const lines: ProductFootprintWriteInput["emissionsSources"] = [];
  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `emissionsSources[${i}] must be an object` };
    }
    const item = row as Record<string, unknown>;
    const source = optionalString(item.source);
    const unit = optionalString(item.unit);
    const quantityRaw = optionalNonNegNumber(
      item.quantity,
      `emissionsSources[${i}].quantity`,
    );
    if (!quantityRaw.ok) return quantityRaw;
    const factorRaw = optionalNonNegNumber(
      item.emissionsFactor,
      `emissionsSources[${i}].emissionsFactor`,
    );
    if (!factorRaw.ok) return factorRaw;
    if (!source) {
      return { ok: false, error: `emissionsSources[${i}].source is required` };
    }
    if (quantityRaw.value === null) {
      return { ok: false, error: `emissionsSources[${i}].quantity is required` };
    }
    if (!unit) {
      return { ok: false, error: `emissionsSources[${i}].unit is required` };
    }
    if (factorRaw.value === null) {
      return {
        ok: false,
        error: `emissionsSources[${i}].emissionsFactor is required`,
      };
    }
    lines.push({
      source,
      quantity: quantityRaw.value,
      unit,
      emissionsFactor: factorRaw.value,
    });
  }
  return { ok: true, value: lines };
}

/**
 * Parse create/update body for product footprint APIs.
 * `partial` allows omitted fields on PUT (caller merges with existing).
 */
export function parseProductFootprintBody(
  body: unknown,
  opts?: { partial?: boolean },
):
  | {
      ok: true;
      value: Partial<ProductFootprintWriteInput> & {
        productName?: string;
        sku?: string;
        category?: string;
      };
    }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid body" };
  }
  const record = body as Record<string, unknown>;
  const partial = opts?.partial === true;
  const out: Partial<ProductFootprintWriteInput> = {};

  if (!partial || record.productName !== undefined) {
    const productName = optionalString(record.productName);
    if (!productName) return { ok: false, error: "productName is required" };
    out.productName = productName;
  }
  if (!partial || record.sku !== undefined) {
    const sku = optionalString(record.sku);
    if (!sku) return { ok: false, error: "sku is required" };
    out.sku = sku;
  }
  if (!partial || record.category !== undefined) {
    const category = optionalString(record.category);
    if (!category) return { ok: false, error: "category is required" };
    out.category = category;
  }
  if (!partial || record.description !== undefined) {
    out.description = optionalString(record.description);
  }
  if (!partial || record.unit !== undefined) {
    const unit = record.unit === undefined ? "per_unit" : record.unit;
    if (!isProductFootprintUnit(unit)) {
      return {
        ok: false,
        error: "unit must be per_unit, per_kg, per_liter, or per_service",
      };
    }
    out.unit = unit;
  }
  if (!partial || record.periodId !== undefined) {
    out.periodId = optionalString(record.periodId);
  }
  if (!partial || record.status !== undefined) {
    const status = record.status === undefined ? "draft" : record.status;
    if (!isProductFootprintStatus(status)) {
      return {
        ok: false,
        error: "status must be draft, published, verified, or superseded",
      };
    }
    out.status = status;
  }

  if (!partial || record.billOfMaterials !== undefined) {
    const bom = parseBom(record.billOfMaterials);
    if (!bom.ok) return bom;
    out.billOfMaterials = bom.value;
  }
  if (!partial || record.emissionsSources !== undefined) {
    const sources = parseSources(record.emissionsSources);
    if (!sources.ok) return sources;
    out.emissionsSources = sources.value;
  }

  const optionalFields: Array<[keyof ProductFootprintWriteInput, string]> = [
    ["primaryPackaging", "primaryPackaging"],
    ["secondaryPackaging", "secondaryPackaging"],
    ["transportOrigin", "transportOrigin"],
    ["transportDestination", "transportDestination"],
  ];
  for (const [key, field] of optionalFields) {
    if (!partial || record[field] !== undefined) {
      out[key] = optionalString(record[field]) as never;
    }
  }

  const numberFields: Array<[keyof ProductFootprintWriteInput, string]> = [
    ["primaryWeight", "primaryWeight"],
    ["secondaryWeight", "secondaryWeight"],
    ["totalPackagingEmissions", "totalPackagingEmissions"],
    ["transportDistance", "transportDistance"],
    ["transportEmissionsFactor", "transportEmissionsFactor"],
    ["transportUnitsShipped", "transportUnitsShipped"],
    ["emissionsFromDecomposition", "emissionsFromDecomposition"],
  ];
  for (const [key, field] of numberFields) {
    if (!partial || record[field] !== undefined) {
      const parsed = optionalNonNegNumber(record[field], field);
      if (!parsed.ok) return parsed;
      out[key] = parsed.value as never;
    }
  }

  // recyclingBenefit may be negative (credit)
  if (!partial || record.recyclingBenefit !== undefined) {
    if (
      record.recyclingBenefit === null ||
      record.recyclingBenefit === undefined ||
      record.recyclingBenefit === ""
    ) {
      out.recyclingBenefit = null;
    } else {
      const n =
        typeof record.recyclingBenefit === "number"
          ? record.recyclingBenefit
          : Number(record.recyclingBenefit);
      if (!Number.isFinite(n)) {
        return { ok: false, error: "recyclingBenefit must be a number" };
      }
      out.recyclingBenefit = n;
    }
  }

  if (!partial || record.transportMode !== undefined) {
    if (
      record.transportMode === null ||
      record.transportMode === undefined ||
      record.transportMode === ""
    ) {
      out.transportMode = null;
    } else if (!isProductTransportMode(record.transportMode)) {
      return { ok: false, error: "transportMode must be ocean, air, truck, or rail" };
    } else {
      out.transportMode = record.transportMode;
    }
  }

  return { ok: true, value: out };
}

export function toPayloadData(
  input: ProductFootprintWriteInput,
  organisationId: string,
): Record<string, unknown> {
  return {
    organisation: organisationId,
    productName: input.productName,
    sku: input.sku,
    category: input.category,
    description: input.description,
    unit: input.unit,
    period: input.periodId,
    status: input.status,
    billOfMaterials: input.billOfMaterials.map((line) => ({
      material: line.material,
      quantity: line.quantity,
      unit: line.unit,
      supplierEmissionFactor: line.supplierEmissionFactor,
      factorSource: line.factorSource,
    })),
    emissionsSources: input.emissionsSources.map((line) => ({
      source: line.source,
      quantity: line.quantity,
      unit: line.unit,
      emissionsFactor: line.emissionsFactor,
    })),
    primaryPackaging: input.primaryPackaging,
    primaryWeight: input.primaryWeight,
    secondaryPackaging: input.secondaryPackaging,
    secondaryWeight: input.secondaryWeight,
    totalPackagingEmissions: input.totalPackagingEmissions,
    transportOrigin: input.transportOrigin,
    transportDestination: input.transportDestination,
    transportDistance: input.transportDistance,
    transportMode: input.transportMode,
    transportEmissionsFactor: input.transportEmissionsFactor,
    transportUnitsShipped: input.transportUnitsShipped,
    emissionsFromDecomposition: input.emissionsFromDecomposition,
    recyclingBenefit: input.recyclingBenefit,
  };
}

export function dtoToWriteInput(
  dto: {
    productName: string;
    sku: string;
    category: string;
    description: string | null;
    unit: ProductFootprintUnit;
    periodId: string | null;
    status: ProductFootprintStatus;
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
  },
  patch: Partial<ProductFootprintWriteInput>,
): ProductFootprintWriteInput {
  return {
    productName: patch.productName ?? dto.productName,
    sku: patch.sku ?? dto.sku,
    category: patch.category ?? dto.category,
    description: patch.description !== undefined ? patch.description : dto.description,
    unit: patch.unit ?? dto.unit,
    periodId: patch.periodId !== undefined ? patch.periodId : dto.periodId,
    status: patch.status ?? dto.status,
    billOfMaterials: patch.billOfMaterials ?? dto.billOfMaterials,
    emissionsSources: patch.emissionsSources ?? dto.emissionsSources,
    primaryPackaging:
      patch.primaryPackaging !== undefined
        ? patch.primaryPackaging
        : dto.primaryPackaging,
    primaryWeight:
      patch.primaryWeight !== undefined ? patch.primaryWeight : dto.primaryWeight,
    secondaryPackaging:
      patch.secondaryPackaging !== undefined
        ? patch.secondaryPackaging
        : dto.secondaryPackaging,
    secondaryWeight:
      patch.secondaryWeight !== undefined ? patch.secondaryWeight : dto.secondaryWeight,
    totalPackagingEmissions:
      patch.totalPackagingEmissions !== undefined
        ? patch.totalPackagingEmissions
        : dto.totalPackagingEmissions,
    transportOrigin:
      patch.transportOrigin !== undefined ? patch.transportOrigin : dto.transportOrigin,
    transportDestination:
      patch.transportDestination !== undefined
        ? patch.transportDestination
        : dto.transportDestination,
    transportDistance:
      patch.transportDistance !== undefined
        ? patch.transportDistance
        : dto.transportDistance,
    transportMode:
      patch.transportMode !== undefined ? patch.transportMode : dto.transportMode,
    transportEmissionsFactor:
      patch.transportEmissionsFactor !== undefined
        ? patch.transportEmissionsFactor
        : dto.transportEmissionsFactor,
    transportUnitsShipped:
      patch.transportUnitsShipped !== undefined
        ? patch.transportUnitsShipped
        : dto.transportUnitsShipped,
    emissionsFromDecomposition:
      patch.emissionsFromDecomposition !== undefined
        ? patch.emissionsFromDecomposition
        : dto.emissionsFromDecomposition,
    recyclingBenefit:
      patch.recyclingBenefit !== undefined
        ? patch.recyclingBenefit
        : dto.recyclingBenefit,
  };
}
