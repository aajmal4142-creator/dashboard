import type { Payload, Where } from "payload";

import type { FactorRecord } from "@/lib/calc";
import {
  DEFAULT_EMISSIONS_STANDARD,
  type EmissionsStandard,
  isEmissionsStandard,
} from "@/lib/factors/standards";

export type LoadEmissionFactorsOpts = {
  /** When set, only rows tagged with this methodology standard are returned. */
  standard?: EmissionsStandard;
  limit?: number;
};

/**
 * Load EmissionFactors registry rows as pure FactorRecords for the calc engine.
 * Never hardcode factor values here — registry only.
 */
export async function loadEmissionFactors(
  payload: Payload,
  opts: LoadEmissionFactorsOpts = {},
): Promise<FactorRecord[]> {
  const standard = opts.standard;
  const where: Where | undefined = standard
    ? { standard: { equals: standard } }
    : undefined;

  const result = await payload.find({
    collection: "emission-factors",
    where,
    limit: opts.limit ?? 500,
    overrideAccess: true,
  });

  return result.docs.map((f) => ({
    id: String(f.id),
    key: f.key,
    value: f.value,
    unit: f.unit,
    source: f.source,
    standard: isEmissionsStandard(f.standard) ? f.standard : undefined,
    publicationYear: f.publicationYear,
    region: f.region,
    validFrom: f.validFrom ? String(f.validFrom) : undefined,
    validUntil: f.validUntil ? String(f.validUntil) : undefined,
    uncertaintyPct:
      typeof f.uncertaintyPct === "number" && Number.isFinite(f.uncertaintyPct)
        ? f.uncertaintyPct
        : undefined,
  }));
}

export async function loadOrgEmissionFactors(
  payload: Payload,
  org: { settings?: { emissionsStandard?: string | null } | null },
): Promise<{ factors: FactorRecord[]; standard: EmissionsStandard }> {
  const raw = org.settings?.emissionsStandard;
  const standard = isEmissionsStandard(raw) ? raw : DEFAULT_EMISSIONS_STANDARD;
  const factors = await loadEmissionFactors(payload, { standard });
  return { factors, standard };
}
