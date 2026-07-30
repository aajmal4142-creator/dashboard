/**
 * Emissions factor methodology standards an organisation may select.
 * Distinct from EmissionFactor.source (publisher / citation).
 */
export const EMISSIONS_STANDARDS = ["DEFRA", "IPCC", "GHGProtocol2004"] as const;

export type EmissionsStandard = (typeof EMISSIONS_STANDARDS)[number];

/** Audit-default when org has not chosen a standard. */
export const DEFAULT_EMISSIONS_STANDARD: EmissionsStandard = "GHGProtocol2004";

export const EMISSIONS_STANDARD_LABELS: Record<EmissionsStandard, string> = {
  DEFRA: "DEFRA conversion factors",
  IPCC: "IPCC emission factors",
  GHGProtocol2004: "GHG Protocol (2004)",
};

export function isEmissionsStandard(value: unknown): value is EmissionsStandard {
  return (
    typeof value === "string" &&
    (EMISSIONS_STANDARDS as readonly string[]).includes(value)
  );
}

export function resolveOrgEmissionsStandard(org: {
  settings?: { emissionsStandard?: string | null } | null;
}): EmissionsStandard {
  const raw = org.settings?.emissionsStandard;
  return isEmissionsStandard(raw) ? raw : DEFAULT_EMISSIONS_STANDARD;
}
