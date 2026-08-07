/**
 * Open Supply Hub (OS Hub) integration helpers — Feature Y07.
 *
 * Pure. Zero I/O. OS Hub assigns every facility a free, universal "OS ID"
 * (e.g. "US2021250D1DTN7"). The public profile for a facility lives at
 * https://opensupplyhub.org/facilities/{OS ID} — documented in OS Hub's own
 * "share your OS ID and profile link" guidance
 * (https://info.opensupplyhub.org/facilities). We never invent or guess IDs —
 * this module only formats/validates one an operator entered.
 */

export const OPEN_SUPPLY_HUB_FACILITY_BASE_URL = "https://opensupplyhub.org/facilities";

/**
 * Loose sanity check — OS IDs are alphanumeric with no whitespace, typically
 * 10–20 chars (country code + year + hash), e.g. "US2021250D1DTN7". We do not
 * enforce the exact internal format since OS Hub may evolve it; this only
 * rejects obviously malformed input (empty, whitespace, punctuation).
 */
export function isPlausibleOpenSupplyHubId(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length > 40) return false;
  return /^[A-Za-z0-9-]+$/.test(trimmed);
}

/**
 * Builds the public OS Hub facility profile URL for a given OS ID.
 * Returns null for empty/invalid input — never fabricates a link.
 */
export function buildOpenSupplyHubUrl(osId: string | null | undefined): string | null {
  if (!osId) return null;
  const trimmed = osId.trim();
  if (!isPlausibleOpenSupplyHubId(trimmed)) return null;
  return `${OPEN_SUPPLY_HUB_FACILITY_BASE_URL}/${encodeURIComponent(trimmed)}`;
}

/** Normalises free-text OS ID input for storage: trims, uppercases. */
export function normaliseOpenSupplyHubId(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}
