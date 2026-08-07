import type { Payload, Where } from "payload";

import { FINANCED_EMISSIONS_SLUG } from "@/collections/FinancedEmissions";

import {
  computePcafAttribution,
  isPcafDataSource,
  summarisePcafPortfolio,
  type PcafAttributionResult,
  type PcafDataSource,
  type PcafPortfolioSummary,
} from "./attribution";

export const PCAF_CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;
export type PcafCurrency = (typeof PCAF_CURRENCIES)[number];

export function isPcafCurrency(value: unknown): value is PcafCurrency {
  return PCAF_CURRENCIES.includes(value as PcafCurrency);
}

export const PCAF_ASSET_CLASSES = [
  "listed_equity_corporate_bonds",
  "business_loans_unlisted_equity",
  "project_finance",
  "commercial_real_estate",
  "motor_vehicle_loans",
] as const;
export type PcafAssetClass = (typeof PCAF_ASSET_CLASSES)[number];

export function isPcafAssetClass(value: unknown): value is PcafAssetClass {
  return PCAF_ASSET_CLASSES.includes(value as PcafAssetClass);
}

export type FinancedEmissionDto = {
  id: string;
  counterparty: string;
  assetClass: PcafAssetClass;
  outstandingAmount: number;
  evic: number | null;
  currency: string;
  borrowerScope1Tco2e: number | null;
  borrowerScope2Tco2e: number | null;
  borrowerScope3Tco2e: number | null;
  dataSource: PcafDataSource;
  periodId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  attribution: PcafAttributionResult;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

export function docToFinancedEmission(doc: {
  id: string;
  counterparty?: unknown;
  assetClass?: unknown;
  outstandingAmount?: unknown;
  evic?: unknown;
  currency?: unknown;
  borrowerScope1Tco2e?: unknown;
  borrowerScope2Tco2e?: unknown;
  borrowerScope3Tco2e?: unknown;
  dataSource?: unknown;
  period?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): FinancedEmissionDto {
  const outstandingAmount = optionalNumber(doc.outstandingAmount) ?? 0;
  const evic = optionalNumber(doc.evic);
  const borrowerScope1Tco2e = optionalNumber(doc.borrowerScope1Tco2e);
  const borrowerScope2Tco2e = optionalNumber(doc.borrowerScope2Tco2e);
  const borrowerScope3Tco2e = optionalNumber(doc.borrowerScope3Tco2e);
  const dataSource = isPcafDataSource(doc.dataSource)
    ? doc.dataSource
    : "economic_activity_proxy";

  const attribution = computePcafAttribution({
    outstandingAmount,
    evic,
    borrowerScope1Tco2e,
    borrowerScope2Tco2e,
    borrowerScope3Tco2e,
    dataSource,
  });

  return {
    id: String(doc.id),
    counterparty: String(doc.counterparty ?? ""),
    assetClass: isPcafAssetClass(doc.assetClass)
      ? doc.assetClass
      : "listed_equity_corporate_bonds",
    outstandingAmount,
    evic,
    currency: typeof doc.currency === "string" ? doc.currency : "USD",
    borrowerScope1Tco2e,
    borrowerScope2Tco2e,
    borrowerScope3Tco2e,
    dataSource,
    periodId: relationId(doc.period),
    notes: optionalString(doc.notes),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
    attribution,
  };
}

export async function listOrgFinancedEmissions(
  payload: Payload,
  organisationId: string,
  opts?: { periodId?: string },
): Promise<FinancedEmissionDto[]> {
  const clauses: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.periodId) {
    clauses.push({ period: { equals: opts.periodId } });
  }
  const result = await payload.find({
    collection: FINANCED_EMISSIONS_SLUG,
    where: { and: clauses },
    depth: 0,
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });
  return result.docs.map((d) => docToFinancedEmission(d));
}

export async function getOrgFinancedEmission(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<FinancedEmissionDto | null> {
  const doc = await payload
    .findByID({
      collection: FINANCED_EMISSIONS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return null;
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) return null;
  return docToFinancedEmission(doc);
}

export function buildPcafSummary(rows: FinancedEmissionDto[]): PcafPortfolioSummary {
  return summarisePcafPortfolio(rows.map((r) => r.attribution));
}

export { optionalNumber, optionalString, relationId };
