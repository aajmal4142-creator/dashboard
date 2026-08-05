import type { Payload, Where } from "payload";

import { CARBON_CREDITS_SLUG } from "@/collections/CarbonCredits";

import { evaluateClaimDisclosure } from "./claimPack";
import type { ClaimDisclosureGuard } from "./claimPack";
import { calculateResidual, isCreditStatus, isCreditType } from "./residual";
import type { CreditStatus, CreditType, ResidualPosition } from "./types";

export type CarbonCreditDto = {
  id: string;
  label: string | null;
  creditType: CreditType;
  volumeTco2e: number;
  vintageYear: number;
  status: CreditStatus;
  registryName: string;
  serial: string | null;
  projectName: string | null;
  projectId: string | null;
  methodology: string | null;
  periodId: string | null;
  periodLabel: string | null;
  retiredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResidualLedgerSummary = {
  periodId: string | null;
  periodLabel: string | null;
  credits: CarbonCreditDto[];
  position: ResidualPosition;
  claimGuard: ClaimDisclosureGuard;
  /** Echo of operator-entered residual inputs for the summary request. */
  inputs: {
    grossInventoryTco2e: number | null;
    reductionsTco2e: number | null;
  };
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function relationLabel(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if ("label" in value && typeof (value as { label: unknown }).label === "string") {
    return (value as { label: string }).label;
  }
  return null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

export function docToCarbonCredit(doc: {
  id: string;
  label?: unknown;
  creditType?: unknown;
  volumeTco2e?: unknown;
  vintageYear?: unknown;
  status?: unknown;
  registryName?: unknown;
  serial?: unknown;
  projectName?: unknown;
  projectId?: unknown;
  methodology?: unknown;
  period?: unknown;
  retiredAt?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): CarbonCreditDto {
  const creditType = isCreditType(doc.creditType) ? doc.creditType : "other";
  const status = isCreditStatus(doc.status) ? doc.status : "held";
  const volume = Number(doc.volumeTco2e);
  return {
    id: String(doc.id),
    label: optionalString(doc.label),
    creditType,
    volumeTco2e: Number.isFinite(volume) ? volume : 0,
    vintageYear: Number(doc.vintageYear) || 0,
    status,
    registryName: String(doc.registryName ?? ""),
    serial: optionalString(doc.serial),
    projectName: optionalString(doc.projectName),
    projectId: optionalString(doc.projectId),
    methodology: optionalString(doc.methodology),
    periodId: relationId(doc.period),
    periodLabel: relationLabel(doc.period),
    retiredAt:
      doc.retiredAt === null || doc.retiredAt === undefined
        ? null
        : String(doc.retiredAt),
    notes: optionalString(doc.notes),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgCredits(
  payload: Payload,
  organisationId: string,
  opts?: { periodId?: string; status?: CreditStatus },
): Promise<CarbonCreditDto[]> {
  const and: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.periodId) {
    and.push({ period: { equals: opts.periodId } });
  }
  if (opts?.status) {
    and.push({ status: { equals: opts.status } });
  }

  const result = await payload.find({
    collection: CARBON_CREDITS_SLUG,
    where: { and },
    limit: 500,
    sort: "-updatedAt",
    depth: 1,
    overrideAccess: true,
  });

  return result.docs.map((d) => docToCarbonCredit(d));
}

export async function getOrgCredit(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<CarbonCreditDto | null> {
  try {
    const doc = await payload.findByID({
      collection: CARBON_CREDITS_SLUG,
      id,
      depth: 1,
      overrideAccess: true,
    });
    if (relationId(doc.organisation) !== organisationId) return null;
    return docToCarbonCredit(doc);
  } catch {
    return null;
  }
}

export async function listOrgPeriods(
  payload: Payload,
  organisationId: string,
): Promise<Array<{ id: string; label: string; status: string }>> {
  const result = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    limit: 100,
    sort: "-startDate",
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((d) => ({
    id: String(d.id),
    label: String(d.label ?? ""),
    status: String(d.status ?? "open"),
  }));
}

function parseOptionalNonNeg(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Build residual ledger summary for an org (optionally scoped to a period).
 * Gross inventory and reductions are operator-entered — never inferred as zero.
 */
export async function buildResidualLedgerSummary(
  payload: Payload,
  organisationId: string,
  opts?: {
    periodId?: string | null;
    grossInventoryTco2e?: number | null;
    reductionsTco2e?: number | null;
  },
): Promise<ResidualLedgerSummary> {
  const periodId = opts?.periodId ?? null;
  const credits = await listOrgCredits(payload, organisationId, {
    periodId: periodId ?? undefined,
  });

  let periodLabel: string | null = null;
  if (periodId) {
    const period = await payload
      .findByID({
        collection: "reporting-periods",
        id: periodId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
    if (period && relationId(period.organisation) === organisationId) {
      periodLabel = String(period.label ?? "");
    }
  }

  const grossInventoryTco2e =
    opts?.grossInventoryTco2e === undefined ? null : opts.grossInventoryTco2e;
  const reductionsTco2e =
    opts?.reductionsTco2e === undefined ? null : opts.reductionsTco2e;

  const position = calculateResidual({
    grossInventoryTco2e,
    reductionsTco2e,
    lots: credits.map((c) => ({
      volumeTco2e: c.volumeTco2e,
      status: c.status,
      creditType: c.creditType,
    })),
  });

  const claimGuard = evaluateClaimDisclosure(
    credits.map((c) => ({
      id: c.id,
      label: c.label,
      status: c.status,
      volumeTco2e: c.volumeTco2e,
      registryName: c.registryName,
      serial: c.serial,
      projectName: c.projectName,
      projectId: c.projectId,
      methodology: c.methodology,
    })),
  );

  return {
    periodId,
    periodLabel,
    credits,
    position,
    claimGuard,
    inputs: {
      grossInventoryTco2e,
      reductionsTco2e,
    },
  };
}

export { parseOptionalNonNeg, relationId };
