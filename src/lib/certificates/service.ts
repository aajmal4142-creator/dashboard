import type { Payload, Where } from "payload";

import type { Scope2ContractualInstrument } from "@/lib/calc/types";
import { FACTOR_KEYS } from "@/lib/calc/emissions";
import { tryResolveFactor } from "@/lib/calc/resolveFactor";
import { loadOrgEmissionFactors, resolveOrgEmissionsStandard } from "@/lib/factors";
import { ENERGY_CERTIFICATES_SLUG } from "@/collections/EnergyCertificates";

import { summariseCertificateVolumes } from "./aggregate";
import type {
  CertificateStatus,
  CertificateType,
  CertificateVolumeSummary,
} from "./types";
import { isCertificateStatus, isCertificateType } from "./aggregate";
import {
  buildMarketBasedHookSummary,
  certificatesToScope2Instruments,
  instrumentsUsedDefaultZeroFactor,
  type MarketBasedHookSummary,
} from "./toScope2Instruments";

export type EnergyCertificateDto = {
  id: string;
  label: string | null;
  certificateType: CertificateType;
  volumeKwh: number;
  /** Optional stored instrument factor (kgCO2e/kWh); null → default 0 at calc wire. */
  factorKgPerKwh: number | null;
  vintageYear: number;
  region: string;
  country: string | null;
  status: CertificateStatus;
  periodId: string;
  periodLabel: string | null;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CertificateLedgerSummary = {
  periodId: string | null;
  periodLabel: string | null;
  certificates: EnergyCertificateDto[];
  volumes: CertificateVolumeSummary;
  /**
   * Market-based Scope 2 readiness from active certificate coverage + residual_mix.
   * Instruments flow into calculate() via loadActiveScope2Instruments — see
   * reports/buildSnapshot, runway home, and realtime KPI snapshot builders.
   */
  marketBasedHook: MarketBasedHookSummary;
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

function optionalNonNegNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function docToEnergyCertificate(doc: {
  id: string;
  label?: unknown;
  certificateType?: unknown;
  volumeKwh?: unknown;
  factorKgPerKwh?: unknown;
  vintageYear?: unknown;
  region?: unknown;
  country?: unknown;
  status?: unknown;
  period?: unknown;
  supplier?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): EnergyCertificateDto {
  const certificateType = isCertificateType(doc.certificateType)
    ? doc.certificateType
    : "REC";
  const status = isCertificateStatus(doc.status) ? doc.status : "active";
  const volume = Number(doc.volumeKwh);
  return {
    id: String(doc.id),
    label: optionalString(doc.label),
    certificateType,
    volumeKwh: Number.isFinite(volume) ? volume : 0,
    factorKgPerKwh: optionalNonNegNumber(doc.factorKgPerKwh),
    vintageYear: Number(doc.vintageYear) || 0,
    region: String(doc.region ?? ""),
    country: optionalString(doc.country)?.toUpperCase() ?? null,
    status,
    periodId: relationId(doc.period) ?? "",
    periodLabel: relationLabel(doc.period),
    supplier: optionalString(doc.supplier),
    notes: optionalString(doc.notes),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgCertificates(
  payload: Payload,
  organisationId: string,
  opts?: { periodId?: string; status?: CertificateStatus },
): Promise<EnergyCertificateDto[]> {
  const and: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.periodId) {
    and.push({ period: { equals: opts.periodId } });
  }
  if (opts?.status) {
    and.push({ status: { equals: opts.status } });
  }

  const result = await payload.find({
    collection: ENERGY_CERTIFICATES_SLUG,
    where: { and },
    limit: 500,
    sort: "-updatedAt",
    depth: 1,
    overrideAccess: true,
  });

  return result.docs.map((d) => docToEnergyCertificate(d));
}

/**
 * Active energy certificates → CalcContext.scope2Instruments for the period.
 * Wire point for F6 market-based Scope 2: pass the result into calculate().
 */
export async function loadActiveScope2Instruments(
  payload: Payload,
  organisationId: string,
  periodId?: string | null,
): Promise<Scope2ContractualInstrument[]> {
  if (!periodId) return [];
  const certificates = await listOrgCertificates(payload, organisationId, {
    periodId,
    status: "active",
  });
  return certificatesToScope2Instruments(
    certificates.map((c) => ({
      id: c.id,
      volumeKwh: c.volumeKwh,
      status: c.status,
      certificateType: c.certificateType,
      label: c.label,
      factorKgPerKwh: c.factorKgPerKwh,
      supplier: c.supplier,
    })),
  );
}

export async function getOrgCertificate(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<EnergyCertificateDto | null> {
  try {
    const doc = await payload.findByID({
      collection: ENERGY_CERTIFICATES_SLUG,
      id,
      depth: 1,
      overrideAccess: true,
    });
    if (relationId(doc.organisation) !== organisationId) return null;
    return docToEnergyCertificate(doc);
  } catch {
    return null;
  }
}

/**
 * Sum electricity_kwh datapoints for the org (optionally scoped to a period).
 * Missing datapoints → null (never silent zero for coverage).
 */
export async function getOrgElectricityKwh(
  payload: Payload,
  organisationId: string,
  periodId?: string | null,
): Promise<number | null> {
  const and: Where[] = [
    { organisation: { equals: organisationId } },
    { metricKey: { equals: "electricity_kwh" } },
  ];
  if (periodId) {
    and.push({ period: { equals: periodId } });
  }

  const result = await payload.find({
    collection: "datapoints",
    where: { and },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  if (result.docs.length === 0) return null;

  let sum = 0;
  let anyFinite = false;
  for (const doc of result.docs) {
    const v = doc.value;
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    sum += n;
    anyFinite = true;
  }
  return anyFinite ? sum : null;
}

export async function resolveOrgPeriodId(
  payload: Payload,
  organisationId: string,
  periodRef: string,
): Promise<{ id: string; label: string } | null> {
  const byId = await payload
    .findByID({
      collection: "reporting-periods",
      id: periodRef,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);

  if (byId && relationId(byId.organisation) === organisationId) {
    return { id: String(byId.id), label: String(byId.label ?? "") };
  }

  const byLabel = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { label: { equals: periodRef } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = byLabel.docs[0];
  if (!doc) return null;
  return { id: String(doc.id), label: String(doc.label ?? "") };
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

export async function buildCertificateLedgerSummary(
  payload: Payload,
  organisationId: string,
  periodId?: string | null,
): Promise<CertificateLedgerSummary> {
  const certificates = await listOrgCertificates(payload, organisationId, {
    periodId: periodId ?? undefined,
  });
  const electricityKwh = await getOrgElectricityKwh(
    payload,
    organisationId,
    periodId ?? null,
  );

  let periodLabel: string | null = null;
  let periodYear = new Date().getFullYear();
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
      periodYear = new Date(String(period.endDate)).getFullYear() || periodYear;
    }
  }

  const volumes = summariseCertificateVolumes({
    certificates: certificates.map((c) => ({
      volumeKwh: c.volumeKwh,
      status: c.status,
      certificateType: c.certificateType,
    })),
    electricityKwh,
  });

  const instrumentInputs = certificates.map((c) => ({
    id: c.id,
    volumeKwh: c.volumeKwh,
    status: c.status,
    certificateType: c.certificateType,
    label: c.label,
    factorKgPerKwh: c.factorKgPerKwh,
    supplier: c.supplier,
  }));
  const instruments = certificatesToScope2Instruments(instrumentInputs);

  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  const region = org.country || "GB";
  const emissionsStandard = resolveOrgEmissionsStandard(org);
  const { factors } = await loadOrgEmissionFactors(payload, {
    id: organisationId,
    settings: { emissionsStandard },
  });
  const residualMixAvailable = Boolean(
    tryResolveFactor(factors, FACTOR_KEYS.residualMix, region, periodYear),
  );

  const marketBasedHook = buildMarketBasedHookSummary({
    volumes,
    instrumentCount: instruments.length,
    residualMixAvailable,
    usedDefaultZeroFactor: instrumentsUsedDefaultZeroFactor(instrumentInputs),
  });

  return {
    periodId: periodId ?? null,
    periodLabel,
    certificates,
    volumes,
    marketBasedHook,
  };
}

export { relationId };
