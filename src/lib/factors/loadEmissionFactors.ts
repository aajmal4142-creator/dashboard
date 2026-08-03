import type { Payload, Where } from "payload";

import type { FactorRecord } from "@/lib/calc";
import {
  DEFAULT_EMISSIONS_STANDARD,
  type EmissionsStandard,
  isEmissionsStandard,
} from "@/lib/factors/standards";
import {
  docToFactorRecord,
  globalActiveFactorWhere,
  loadOrgCustomFactorRecords,
} from "@/lib/factors/orgCustom";

export type LoadEmissionFactorsOpts = {
  /** When set, only rows tagged with this methodology standard are returned. */
  standard?: EmissionsStandard;
  limit?: number;
  /** When set, active org custom factors are prepended (win year ties in resolveFactor). */
  organisationId?: string;
};

/**
 * Load EmissionFactors registry rows as pure FactorRecords for the calc engine.
 * Never hardcode factor values here — registry only.
 *
 * Global seeds (no organisation) plus optional org customs. Deactivated customs
 * are excluded. Missing keys still throw in resolveFactor — no silent defaults.
 */
export async function loadEmissionFactors(
  payload: Payload,
  opts: LoadEmissionFactorsOpts = {},
): Promise<FactorRecord[]> {
  const standard = opts.standard;
  const where: Where = globalActiveFactorWhere(standard);

  const result = await payload.find({
    collection: "emission-factors",
    where,
    limit: opts.limit ?? 500,
    overrideAccess: true,
  });

  const globals = result.docs.map(docToFactorRecord);

  if (!opts.organisationId) {
    return globals;
  }

  const customs = await loadOrgCustomFactorRecords(
    payload,
    opts.organisationId,
    standard,
  );

  // Org customs first so equal publicationYear prefers the custom row in resolveFactor.
  return [...customs, ...globals];
}

export async function loadOrgEmissionFactors(
  payload: Payload,
  org: {
    id?: string;
    settings?: { emissionsStandard?: string | null } | null;
  },
): Promise<{ factors: FactorRecord[]; standard: EmissionsStandard }> {
  const raw = org.settings?.emissionsStandard;
  const standard = isEmissionsStandard(raw) ? raw : DEFAULT_EMISSIONS_STANDARD;
  const factors = await loadEmissionFactors(payload, {
    standard,
    organisationId: typeof org.id === "string" ? org.id : undefined,
  });
  return { factors, standard };
}
