import type { Payload, Where } from "payload";

import { CBAM_DECLARATIONS_SLUG } from "@/collections/CbamDeclarations";
import { CBAM_GOODS_SLUG } from "@/collections/CbamGoods";

import { calculateCbamLineEmissions, estimateCbamLiability } from "./liability";
import type {
  CbamDeclarationStatus,
  CbamGoodInput,
  CbamLiabilityResult,
  CbamLineResult,
  CbamQuarter,
  CbamQuantityUnit,
} from "./types";

export type CbamGoodDto = CbamGoodInput & {
  id: string;
  notes: string | null;
  line: CbamLineResult;
  createdAt: string;
  updatedAt: string;
};

export type CbamDeclarationDto = {
  id: string;
  label: string;
  reportingYear: number;
  reportingQuarter: CbamQuarter;
  status: CbamDeclarationStatus;
  certificatePriceEur: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CbamQuarterSummary = {
  reportingYear: number;
  reportingQuarter: CbamQuarter;
  declaration: CbamDeclarationDto | null;
  goods: CbamGoodDto[];
  liability: CbamLiabilityResult;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asQuarter(value: unknown): CbamQuarter | null {
  const v = String(value ?? "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

function asUnit(value: unknown): CbamQuantityUnit {
  if (value === "kg" || value === "mwh" || value === "t") return value;
  return "t";
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function docToCbamGood(doc: {
  id: string;
  cnCode?: unknown;
  description?: unknown;
  quantity?: unknown;
  quantityUnit?: unknown;
  directEmissions?: unknown;
  indirectEmissions?: unknown;
  usesDefaultValues?: unknown;
  installationCountry?: unknown;
  reportingYear?: unknown;
  reportingQuarter?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): CbamGoodDto {
  const quarter = asQuarter(doc.reportingQuarter) ?? "1";
  const input: CbamGoodInput = {
    cnCode: String(doc.cnCode ?? ""),
    description:
      typeof doc.description === "string" && doc.description.trim()
        ? doc.description.trim()
        : null,
    quantity: optionalNumber(doc.quantity),
    quantityUnit: asUnit(doc.quantityUnit),
    directEmissions: optionalNumber(doc.directEmissions),
    indirectEmissions: optionalNumber(doc.indirectEmissions),
    usesDefaultValues: Boolean(doc.usesDefaultValues),
    installationCountry: String(doc.installationCountry ?? "").toUpperCase(),
    reportingYear: Number(doc.reportingYear) || 0,
    reportingQuarter: quarter,
  };
  return {
    id: String(doc.id),
    ...input,
    notes: typeof doc.notes === "string" && doc.notes.trim() ? doc.notes.trim() : null,
    line: calculateCbamLineEmissions(input),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export function docToCbamDeclaration(doc: {
  id: string;
  label?: unknown;
  reportingYear?: unknown;
  reportingQuarter?: unknown;
  status?: unknown;
  certificatePriceEur?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): CbamDeclarationDto {
  const year = Number(doc.reportingYear) || 0;
  const quarter = asQuarter(doc.reportingQuarter) ?? "1";
  const status: CbamDeclarationStatus =
    doc.status === "submitted" ? "submitted" : "draft";
  return {
    id: String(doc.id),
    label:
      typeof doc.label === "string" && doc.label.trim()
        ? doc.label.trim()
        : `${year} Q${quarter}`,
    reportingYear: year,
    reportingQuarter: quarter,
    status,
    certificatePriceEur: optionalNumber(doc.certificatePriceEur),
    notes: typeof doc.notes === "string" && doc.notes.trim() ? doc.notes.trim() : null,
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgCbamGoods(
  payload: Payload,
  organisationId: string,
  opts?: { year?: number; quarter?: CbamQuarter },
): Promise<CbamGoodDto[]> {
  const and: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.year !== undefined) {
    and.push({ reportingYear: { equals: opts.year } });
  }
  if (opts?.quarter !== undefined) {
    and.push({ reportingQuarter: { equals: opts.quarter } });
  }

  const result = await payload.find({
    collection: CBAM_GOODS_SLUG,
    where: { and },
    limit: 500,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.map((d) => docToCbamGood(d));
}

export async function getOrgCbamGood(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<CbamGoodDto | null> {
  try {
    const doc = await payload.findByID({
      collection: CBAM_GOODS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (relationId(doc.organisation) !== organisationId) return null;
    return docToCbamGood(doc);
  } catch {
    return null;
  }
}

export async function findDeclaration(
  payload: Payload,
  organisationId: string,
  year: number,
  quarter: CbamQuarter,
): Promise<CbamDeclarationDto | null> {
  const result = await payload.find({
    collection: CBAM_DECLARATIONS_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { reportingYear: { equals: year } },
        { reportingQuarter: { equals: quarter } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = result.docs[0];
  return doc ? docToCbamDeclaration(doc) : null;
}

export async function listOrgDeclarations(
  payload: Payload,
  organisationId: string,
): Promise<CbamDeclarationDto[]> {
  const result = await payload.find({
    collection: CBAM_DECLARATIONS_SLUG,
    where: { organisation: { equals: organisationId } },
    limit: 100,
    sort: "-reportingYear,-reportingQuarter",
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((d) => docToCbamDeclaration(d));
}

export async function buildQuarterSummary(
  payload: Payload,
  organisationId: string,
  year: number,
  quarter: CbamQuarter,
): Promise<CbamQuarterSummary> {
  const [goods, declaration] = await Promise.all([
    listOrgCbamGoods(payload, organisationId, { year, quarter }),
    findDeclaration(payload, organisationId, year, quarter),
  ]);

  const liability = estimateCbamLiability({
    lines: goods.map((g) => g.line),
    certificatePriceEur: declaration?.certificatePriceEur ?? null,
    defaultValueLineCount: goods.filter((g) => g.usesDefaultValues).length,
  });

  return {
    reportingYear: year,
    reportingQuarter: quarter,
    declaration,
    goods,
    liability,
  };
}

export { relationId };
