import type { Payload, Where } from "payload";

import { ABATEMENT_LEVERS_SLUG } from "@/collections/AbatementLevers";

import { buildMacc, isAbatementLeverCategory } from "./macc";
import type {
  AbatementLeverCategory,
  AbatementLeverInput,
  MaccBuildResult,
} from "./maccTypes";

export type AbatementLeverDto = {
  id: string;
  name: string;
  category: AbatementLeverCategory | null;
  annualAbatementTco2e: number | null;
  capex: number | null;
  opexPerYear: number | null;
  lifetimeYears: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

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

export function docToAbatementLever(doc: {
  id: string;
  name?: unknown;
  category?: unknown;
  annualAbatementTco2e?: unknown;
  capex?: unknown;
  opexPerYear?: unknown;
  lifetimeYears?: unknown;
  notes?: unknown;
  active?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): AbatementLeverDto {
  return {
    id: String(doc.id),
    name: String(doc.name ?? ""),
    category: isAbatementLeverCategory(doc.category) ? doc.category : null,
    annualAbatementTco2e: optionalNumber(doc.annualAbatementTco2e),
    capex: optionalNumber(doc.capex),
    opexPerYear: optionalNumber(doc.opexPerYear),
    lifetimeYears: optionalNumber(doc.lifetimeYears),
    notes: optionalString(doc.notes),
    active: doc.active !== false,
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export function leverDtoToInput(dto: AbatementLeverDto): AbatementLeverInput {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    annualAbatementTco2e: dto.annualAbatementTco2e,
    capex: dto.capex,
    opexPerYear: dto.opexPerYear,
    lifetimeYears: dto.lifetimeYears,
  };
}

export async function listOrgAbatementLevers(
  payload: Payload,
  organisationId: string,
  opts?: { activeOnly?: boolean },
): Promise<AbatementLeverDto[]> {
  const clauses: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.activeOnly) {
    clauses.push({ active: { equals: true } });
  }

  const result = await payload.find({
    collection: ABATEMENT_LEVERS_SLUG,
    where: { and: clauses },
    depth: 0,
    limit: 500,
    sort: "name",
    overrideAccess: true,
  });

  return result.docs.map((d) => docToAbatementLever(d));
}

export async function getOrgAbatementLever(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<AbatementLeverDto | null> {
  try {
    const doc = await payload.findByID({
      collection: ABATEMENT_LEVERS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (relationId(doc.organisation) !== organisationId) return null;
    return docToAbatementLever(doc);
  } catch {
    return null;
  }
}

export function computeOrgMacc(
  levers: AbatementLeverDto[],
  opts?: { carbonPricePerTco2e?: number | null; strict?: boolean },
): MaccBuildResult {
  return buildMacc({
    levers: levers.map(leverDtoToInput),
    carbonPricePerTco2e: opts?.carbonPricePerTco2e ?? null,
    strict: opts?.strict ?? false,
  });
}

export { relationId };
