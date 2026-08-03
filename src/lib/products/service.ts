import type { Payload, Where } from "payload";

import { PRODUCT_LEVEL_FOOTPRINTING_SLUG } from "@/collections/ProductLevelFootprinting";
import { kgCo2eToTco2e } from "@/lib/calc/skuFootprint";

import {
  isProductFootprintStatus,
  isProductFootprintUnit,
  isProductTransportMode,
  qualityFromStored,
  type BomLineDto,
  type EmissionsSourceDto,
  type PeriodOption,
  type ProductFootprintDto,
  type ProductFootprintStatus,
  type StageBreakdownDto,
} from "./types";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseBreakdown(value: unknown): StageBreakdownDto | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const materials = optionalNumber(record.materials);
  const production = optionalNumber(record.production);
  const packaging = optionalNumber(record.packaging);
  const transportation = optionalNumber(record.transportation);
  const endOfLife = optionalNumber(record.endOfLife);
  if (
    materials === null ||
    production === null ||
    packaging === null ||
    transportation === null ||
    endOfLife === null
  ) {
    return null;
  }
  return { materials, production, packaging, transportation, endOfLife };
}

function parseBom(value: unknown): BomLineDto[] {
  if (!Array.isArray(value)) return [];
  const lines: BomLineDto[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const material = optionalString(item.material);
    const quantity = optionalNumber(item.quantity);
    const unit = optionalString(item.unit);
    if (!material || quantity === null || !unit) continue;
    const factorSource =
      item.factorSource === "supplier" ||
      item.factorSource === "industry" ||
      item.factorSource === "custom"
        ? item.factorSource
        : null;
    lines.push({
      id: optionalString(item.id),
      material,
      quantity,
      unit,
      supplierEmissionFactor: optionalNumber(item.supplierEmissionFactor),
      factorSource,
      materialCarbonFootprint: optionalNumber(item.materialCarbonFootprint),
    });
  }
  return lines;
}

function parseSources(value: unknown): EmissionsSourceDto[] {
  if (!Array.isArray(value)) return [];
  const lines: EmissionsSourceDto[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const source = optionalString(item.source);
    const quantity = optionalNumber(item.quantity);
    const unit = optionalString(item.unit);
    const emissionsFactor = optionalNumber(item.emissionsFactor);
    if (!source || quantity === null || !unit || emissionsFactor === null) continue;
    lines.push({
      id: optionalString(item.id),
      source,
      quantity,
      unit,
      emissionsFactor,
      totalEmissions: optionalNumber(item.totalEmissions),
    });
  }
  return lines;
}

function periodLabelFromDoc(period: unknown): string | null {
  if (!period || typeof period !== "object") return null;
  const p = period as { label?: unknown; startDate?: unknown; endDate?: unknown };
  const label = optionalString(p.label);
  if (label) return label;
  const start = optionalString(p.startDate);
  const end = optionalString(p.endDate);
  if (start && end) return `${start.slice(0, 10)} → ${end.slice(0, 10)}`;
  return start?.slice(0, 10) ?? null;
}

export function docToProductFootprint(doc: {
  id: string;
  productName?: unknown;
  sku?: unknown;
  category?: unknown;
  description?: unknown;
  unit?: unknown;
  period?: unknown;
  status?: unknown;
  quality?: unknown;
  totalCarbonFootprint?: unknown;
  breakdownByStage?: unknown;
  billOfMaterials?: unknown;
  emissionsSources?: unknown;
  primaryPackaging?: unknown;
  primaryWeight?: unknown;
  secondaryPackaging?: unknown;
  secondaryWeight?: unknown;
  totalPackagingEmissions?: unknown;
  transportOrigin?: unknown;
  transportDestination?: unknown;
  transportDistance?: unknown;
  transportMode?: unknown;
  transportEmissionsFactor?: unknown;
  transportUnitsShipped?: unknown;
  emissionsFromDecomposition?: unknown;
  recyclingBenefit?: unknown;
  lastCalculatedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): ProductFootprintDto {
  const kg = optionalNumber(doc.totalCarbonFootprint);
  const quality = qualityFromStored(doc.quality);
  const effectiveQuality =
    kg === null && quality === "missing" ? "missing" : kg === null ? "missing" : quality;

  return {
    id: String(doc.id),
    productName: String(doc.productName ?? ""),
    sku: String(doc.sku ?? ""),
    category: String(doc.category ?? ""),
    description: optionalString(doc.description),
    unit: isProductFootprintUnit(doc.unit) ? doc.unit : "per_unit",
    periodId: relationId(doc.period),
    periodLabel: periodLabelFromDoc(doc.period),
    status: isProductFootprintStatus(doc.status) ? doc.status : "draft",
    quality: effectiveQuality,
    totalCarbonFootprintKg: kg,
    totalTco2e: kg === null ? null : kgCo2eToTco2e(kg),
    breakdown: parseBreakdown(doc.breakdownByStage),
    billOfMaterials: parseBom(doc.billOfMaterials),
    emissionsSources: parseSources(doc.emissionsSources),
    primaryPackaging: optionalString(doc.primaryPackaging),
    primaryWeight: optionalNumber(doc.primaryWeight),
    secondaryPackaging: optionalString(doc.secondaryPackaging),
    secondaryWeight: optionalNumber(doc.secondaryWeight),
    totalPackagingEmissions: optionalNumber(doc.totalPackagingEmissions),
    transportOrigin: optionalString(doc.transportOrigin),
    transportDestination: optionalString(doc.transportDestination),
    transportDistance: optionalNumber(doc.transportDistance),
    transportMode: isProductTransportMode(doc.transportMode) ? doc.transportMode : null,
    transportEmissionsFactor: optionalNumber(doc.transportEmissionsFactor),
    transportUnitsShipped: optionalNumber(doc.transportUnitsShipped),
    emissionsFromDecomposition: optionalNumber(doc.emissionsFromDecomposition),
    recyclingBenefit: optionalNumber(doc.recyclingBenefit),
    lastCalculatedAt: optionalString(doc.lastCalculatedAt),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgProductFootprints(
  payload: Payload,
  organisationId: string,
  opts?: { periodId?: string; status?: ProductFootprintStatus },
): Promise<ProductFootprintDto[]> {
  const clauses: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.periodId) {
    clauses.push({ period: { equals: opts.periodId } });
  }
  if (opts?.status) {
    clauses.push({ status: { equals: opts.status } });
  }
  const result = await payload.find({
    collection: PRODUCT_LEVEL_FOOTPRINTING_SLUG,
    where: { and: clauses },
    depth: 1,
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });
  return result.docs.map((doc) => docToProductFootprint(doc));
}

export async function getOrgProductFootprint(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<ProductFootprintDto | null> {
  try {
    const doc = await payload.findByID({
      collection: PRODUCT_LEVEL_FOOTPRINTING_SLUG,
      id,
      depth: 1,
      overrideAccess: true,
    });
    if (!doc) return null;
    const orgId = relationId(doc.organisation);
    if (orgId !== organisationId) return null;
    return docToProductFootprint(doc);
  } catch {
    return null;
  }
}

export async function assertPeriodInOrg(
  payload: Payload,
  organisationId: string,
  periodId: string,
): Promise<boolean> {
  try {
    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    });
    if (!period) return false;
    return relationId(period.organisation) === organisationId;
  } catch {
    return false;
  }
}

export async function listOrgPeriods(
  payload: Payload,
  organisationId: string,
): Promise<PeriodOption[]> {
  const result = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    sort: "-endDate",
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((doc) => {
    const label =
      optionalString(doc.label) ??
      (() => {
        const start = optionalString(doc.startDate)?.slice(0, 10);
        const end = optionalString(doc.endDate)?.slice(0, 10);
        if (start && end) return `${start} → ${end}`;
        return start ?? String(doc.id);
      })();
    return {
      id: String(doc.id),
      label,
      status: String(doc.status ?? ""),
    };
  });
}
