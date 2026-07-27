/**
 * Deterministic Scope 3 reaggregation with provenance + supersession.
 */

import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { FACTOR_KEYS, resolveFactor, type FactorRecord } from "@/lib/calc";
import {
  SUPPLIER_REPORTED_METRIC,
  SUPPLIER_SPEND_ESTIMATE_METRIC,
} from "@/lib/suppliers/composition";
import { NO_SUPPLIER_KEY, supplierKeyFrom } from "@/lib/suppliers/supplierKey";

export type SubmittedSupplierData = {
  electricity_kwh?: number | null;
  diesel_litres?: number | null;
  natural_gas_m3?: number | null;
  business_travel_km?: number | null;
  employees_total?: number | null;
  estimated_tco2e?: number | null;
  /** Explicit metered flag — only then quality may be measured. */
  is_metered?: boolean | null;
};

async function loadFactors(payload: Payload): Promise<FactorRecord[]> {
  const factorsResult = await payload.find({
    collection: "emission-factors",
    limit: 500,
    overrideAccess: true,
  });
  return factorsResult.docs.map((f) => ({
    id: f.id,
    key: f.key,
    value: f.value,
    unit: f.unit,
    source: f.source,
    publicationYear: f.publicationYear,
    region: f.region,
    validFrom: f.validFrom ? String(f.validFrom) : undefined,
    validUntil: f.validUntil ? String(f.validUntil) : undefined,
  }));
}

async function upsertContribution(
  payload: Payload,
  args: {
    organisationId: string;
    periodId: string;
    metricKey: string;
    supplierId: string;
    value: number | null;
    unit: string;
    quality: "measured" | "calculated" | "estimated" | "missing";
    provenance: "supplier_primary" | "spend_estimate";
    factorId?: string | null;
    note: string;
    source: "supplier" | "estimate";
  },
): Promise<{ id: string; created: boolean }> {
  const key = supplierKeyFrom(args.supplierId);
  const existing = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: args.organisationId } },
        { period: { equals: args.periodId } },
        { metricKey: { equals: args.metricKey } },
        { supplierKey: { equals: key } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const data: Record<string, unknown> = {
    organisation: args.organisationId,
    period: args.periodId,
    metricKey: args.metricKey,
    value: args.value ?? undefined,
    unit: args.unit,
    quality: args.quality,
    provenance: args.provenance,
    supplier: args.supplierId,
    supplierKey: key,
    factorId: args.factorId ?? undefined,
    source: args.source,
    note: args.note,
    enteredAt: new Date().toISOString(),
    approvalState: "pending",
  };

  if (existing.docs[0]) {
    const updated = await payload.update({
      collection: "datapoints",
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    });
    return { id: updated.id, created: false };
  }

  const created = await (
    payload.create as (args: {
      collection: "datapoints";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: "datapoints",
    data,
    overrideAccess: true,
  });
  return { id: created.id, created: true };
}

/**
 * Reaggregate all suppliers for an org+period into provenance-aware contribution rows.
 * Supersedes spend estimates when primary data exists. Never writes zero for gaps.
 */
export async function reaggregateScope3Contributions(
  payload: Payload,
  organisationId: string,
  periodId: string,
  opts?: { actorId?: string | null; region?: string; year?: number },
): Promise<void> {
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  const region = opts?.region ?? org.country ?? "GB";
  const year =
    opts?.year ??
    new Date(String(period.endDate)).getFullYear() ??
    new Date().getFullYear();

  const factors = await loadFactors(payload);
  let spendFactor: FactorRecord | null = null;
  try {
    spendFactor = resolveFactor(factors, FACTOR_KEYS.spend, region, year);
  } catch {
    spendFactor = null;
  }

  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: organisationId } },
    limit: 500,
    overrideAccess: true,
  });

  for (const s of suppliers.docs) {
    const submitted = s.submittedData as SubmittedSupplierData | null;
    const hasPrimaryValue =
      submitted != null &&
      typeof submitted.estimated_tco2e === "number" &&
      Number.isFinite(submitted.estimated_tco2e);
    const isMetered = Boolean(submitted?.is_metered);
    const hasResponse = s.requestStatus === "submitted" && hasPrimaryValue;

    if (hasResponse) {
      const quality = isMetered ? ("measured" as const) : ("calculated" as const);
      await upsertContribution(payload, {
        organisationId,
        periodId,
        metricKey: SUPPLIER_REPORTED_METRIC,
        supplierId: s.id,
        value: submitted!.estimated_tco2e!,
        unit: "tCO2e",
        quality,
        provenance: "supplier_primary",
        factorId: null,
        note: isMetered
          ? "Supplier metered emissions"
          : "Supplier-submitted estimated_tco2e (calculated, not measured)",
        source: "supplier",
      });

      // Supersede any spend estimate for this supplier.
      const estimateKey = supplierKeyFrom(s.id);
      const estimates = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            { period: { equals: periodId } },
            { metricKey: { equals: SUPPLIER_SPEND_ESTIMATE_METRIC } },
            { supplierKey: { equals: estimateKey } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      });
      if (estimates.docs[0] && estimates.docs[0].quality !== "missing") {
        const before = {
          quality: estimates.docs[0].quality,
          value: estimates.docs[0].value,
        };
        await payload.update({
          collection: "datapoints",
          id: estimates.docs[0].id,
          data: {
            quality: "missing",
            value: undefined,
            note: "Superseded by supplier_primary response",
          },
          overrideAccess: true,
        });
        await writeAuditLog(payload, {
          organisationId,
          actorId: opts?.actorId ?? null,
          action: "supplier.estimate_superseded",
          entityType: "datapoints",
          entityId: estimates.docs[0].id,
          before,
          after: {
            quality: "missing",
            supplierId: s.id,
            supersededBy: "supplier_primary",
          },
        });
      }
      continue;
    }

    // Spend estimate path — only when spend exists and no primary.
    const spend =
      typeof s.annualSpend === "number" && Number.isFinite(s.annualSpend)
        ? s.annualSpend
        : null;
    if (spend != null && spend > 0 && spendFactor) {
      const tco2e = (spend * spendFactor.value) / 1000;
      await upsertContribution(payload, {
        organisationId,
        periodId,
        metricKey: SUPPLIER_SPEND_ESTIMATE_METRIC,
        supplierId: s.id,
        value: tco2e,
        unit: "tCO2e",
        quality: "estimated",
        provenance: "spend_estimate",
        factorId: spendFactor.id,
        note: `Spend × factor ${spendFactor.key} (${spendFactor.id})`,
        source: "estimate",
      });
    }
    // else: gap — no row, never zero
  }
}

/** @deprecated Use reaggregateScope3Contributions — kept as alias for call sites. */
export async function reaggregateSupplierReported(
  payload: Payload,
  organisationId: string,
  periodId: string,
): Promise<void> {
  await reaggregateScope3Contributions(payload, organisationId, periodId);
}

/**
 * @deprecated Use billing-aware `ensureOpenPeriod` from `@/lib/org/period`.
 * Kept as a thin wrapper that loads org plan/status so Free caps cannot be bypassed.
 */
export async function ensureOpenPeriod(
  payload: Payload,
  organisationId: string,
): Promise<string> {
  const { ensureOpenPeriod: capped } = await import("@/lib/org/period");
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  return capped(organisationId, org.plan, org.subscriptionStatus);
}

/** Ensure legacy org-level writes still set supplierKey sentinel. */
export { NO_SUPPLIER_KEY };
