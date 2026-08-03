import type { Payload, Where } from "payload";

import { PROCUREMENT_TRADEOFFS_SLUG } from "@/collections/ProcurementTradeoffs";
import type { ProcurementTradeoff } from "@/payload-types";

import { buildTradeoffComparison } from "./tradeoff";
import type {
  PurchaseOptionInput,
  TradeoffComparisonResult,
  TradeoffWeights,
} from "./tradeoffTypes";

export type TradeoffOptionDto = {
  optionId: string;
  name: string;
  cost: number | null;
  tco2e: number | null;
  factorTco2ePerUnit: number | null;
  quantity: number | null;
  leadDays: number | null;
};

export type TradeoffScenarioDto = {
  id: string;
  name: string;
  notes: string | null;
  weights: TradeoffWeights;
  options: TradeoffOptionDto[];
  createdAt: string;
  updatedAt: string;
};

function relationId(value: ProcurementTradeoff["organisation"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) return String(value.id);
  return null;
}

function optionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function optionalNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

export function docToTradeoffScenario(doc: ProcurementTradeoff): TradeoffScenarioDto {
  const rows = Array.isArray(doc.options) ? doc.options : [];
  const options: TradeoffOptionDto[] = rows
    .filter((row) => typeof row.name === "string" && row.name.trim())
    .map((row) => ({
      optionId:
        typeof row.optionId === "string" && row.optionId.trim()
          ? row.optionId.trim()
          : `opt-${row.name.trim().toLowerCase().replace(/\s+/g, "-")}`,
      name: row.name.trim(),
      cost: optionalNumber(row.cost),
      tco2e: optionalNumber(row.tco2e),
      factorTco2ePerUnit: optionalNumber(row.factorTco2ePerUnit),
      quantity: optionalNumber(row.quantity),
      leadDays: optionalNumber(row.leadDays),
    }));

  return {
    id: String(doc.id),
    name: String(doc.name ?? ""),
    notes: optionalString(doc.notes),
    weights: {
      cost: optionalNumber(doc.weightCost) ?? 1,
      carbon: optionalNumber(doc.weightCarbon) ?? 1,
      lead: optionalNumber(doc.weightLead) ?? 0,
    },
    options,
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export function optionDtoToInput(dto: TradeoffOptionDto): PurchaseOptionInput {
  return {
    id: dto.optionId,
    name: dto.name,
    cost: dto.cost,
    tco2e: dto.tco2e,
    factorTco2ePerUnit: dto.factorTco2ePerUnit,
    quantity: dto.quantity,
    leadDays: dto.leadDays,
  };
}

export function computeScenarioTradeoff(
  scenario: TradeoffScenarioDto,
): TradeoffComparisonResult {
  return buildTradeoffComparison(
    scenario.options.map(optionDtoToInput),
    scenario.weights,
  );
}

export async function listOrgTradeoffScenarios(
  payload: Payload,
  organisationId: string,
): Promise<TradeoffScenarioDto[]> {
  const where: Where = {
    organisation: { equals: organisationId },
  };

  const result = await payload.find({
    collection: PROCUREMENT_TRADEOFFS_SLUG,
    where,
    limit: 200,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.map((doc) => docToTradeoffScenario(doc));
}

export async function getOrgTradeoffScenario(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<TradeoffScenarioDto | null> {
  try {
    const doc = await payload.findByID({
      collection: PROCUREMENT_TRADEOFFS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
    const org = relationId(doc.organisation);
    if (org !== organisationId) return null;
    return docToTradeoffScenario(doc);
  } catch {
    return null;
  }
}
