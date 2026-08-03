/**
 * Pure helpers for the shared supplier carbon network (F30).
 * Consent-based peer-to-peer Scope 1/2/(optional 3) share — never invent zeros.
 */

export const NETWORK_INVITE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
] as const;

export type NetworkInviteStatus = (typeof NETWORK_INVITE_STATUSES)[number];

export const SNAPSHOT_QUALITIES = ["measured", "partial", "missing"] as const;

export type SnapshotQuality = (typeof SNAPSHOT_QUALITIES)[number];

/** Default invite TTL in days. */
export const NETWORK_INVITE_TTL_DAYS = 30;

export type ScopeTotalsInput = {
  scope1Tco2e: number | null;
  scope2Tco2e: number | null;
  scope3Tco2e: number | null;
};

export type ConsentedSnapshotInput = ScopeTotalsInput & {
  periodLabel: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  note?: string | null;
};

export type ConsentedSnapshot = {
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  scope1Tco2e: number | null;
  scope2Tco2e: number | null;
  scope3Tco2e: number | null;
  quality: SnapshotQuality;
  note: string | null;
};

export function isNetworkInviteStatus(value: unknown): value is NetworkInviteStatus {
  return (
    typeof value === "string" &&
    (NETWORK_INVITE_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidInviteEmail(email: string): boolean {
  const normalized = normalizeInviteEmail(email);
  // Practical email shape — not a full RFC parse.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function inviteExpiryFrom(
  now = new Date(),
  ttlDays = NETWORK_INVITE_TTL_DAYS,
): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + ttlDays);
  return d;
}

export function isInviteExpired(
  expiresAt: string | Date | null | undefined,
  now = new Date(),
): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() < now.getTime();
}

/**
 * Status transitions for consent lifecycle.
 * declined = supplier refusal; revoked = buyer cancellation / withdrawal.
 */
export function canTransitionInvite(
  from: NetworkInviteStatus,
  to: NetworkInviteStatus,
): boolean {
  if (from === to) return false;
  if (
    from === "pending" &&
    (to === "accepted" || to === "declined" || to === "revoked")
  ) {
    return true;
  }
  if (from === "accepted" && to === "revoked") return true;
  return false;
}

function parseNullableScope(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return undefined;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  }
  return undefined;
}

/**
 * Build an explicit consented snapshot. Null scopes stay null — never coerced to 0.
 * At least one of scope1/scope2 must be provided (Scope 3 is optional).
 */
export function buildConsentedSnapshot(
  input: ConsentedSnapshotInput,
): ConsentedSnapshot | { error: string } {
  const periodLabel = input.periodLabel.trim();
  if (!periodLabel) {
    return { error: "periodLabel is required" };
  }

  const scope1 = input.scope1Tco2e;
  const scope2 = input.scope2Tco2e;
  const scope3 = input.scope3Tco2e;

  if (scope1 !== null && (!Number.isFinite(scope1) || scope1 < 0)) {
    return { error: "scope1Tco2e must be a non-negative number or null" };
  }
  if (scope2 !== null && (!Number.isFinite(scope2) || scope2 < 0)) {
    return { error: "scope2Tco2e must be a non-negative number or null" };
  }
  if (scope3 !== null && (!Number.isFinite(scope3) || scope3 < 0)) {
    return { error: "scope3Tco2e must be a non-negative number or null" };
  }

  if (scope1 === null && scope2 === null) {
    return {
      error:
        "Share at least Scope 1 or Scope 2 as an explicit value. Missing scopes stay blank — never treated as zero.",
    };
  }

  const quality = deriveSnapshotQuality({
    scope1Tco2e: scope1,
    scope2Tco2e: scope2,
    scope3Tco2e: scope3,
  });

  return {
    periodLabel,
    periodStart: input.periodStart?.trim() || null,
    periodEnd: input.periodEnd?.trim() || null,
    scope1Tco2e: scope1,
    scope2Tco2e: scope2,
    scope3Tco2e: scope3,
    quality,
    note: input.note?.trim() || null,
  };
}

/**
 * Quality from which scopes were explicitly shared.
 * Scope 3 absence alone does not downgrade — it is optional.
 */
export function deriveSnapshotQuality(scopes: ScopeTotalsInput): SnapshotQuality {
  const has1 = scopes.scope1Tco2e !== null;
  const has2 = scopes.scope2Tco2e !== null;
  if (!has1 && !has2) return "missing";
  if (has1 && has2) return "measured";
  return "partial";
}

/**
 * Parse accept/share body fields. Empty string → null (not zero).
 */
export function parseShareBody(body: Record<string, unknown>):
  | ConsentedSnapshotInput
  | {
      error: string;
    } {
  const periodLabel = typeof body.periodLabel === "string" ? body.periodLabel : "";
  if (!periodLabel.trim()) {
    return { error: "periodLabel is required" };
  }

  const scope1 = parseNullableScope(body.scope1Tco2e);
  const scope2 = parseNullableScope(body.scope2Tco2e);
  const scope3 = parseNullableScope(body.scope3Tco2e);
  if (scope1 === undefined) {
    return { error: "scope1Tco2e must be a non-negative number or empty" };
  }
  if (scope2 === undefined) {
    return { error: "scope2Tco2e must be a non-negative number or empty" };
  }
  if (scope3 === undefined) {
    return { error: "scope3Tco2e must be a non-negative number or empty" };
  }

  return {
    periodLabel,
    periodStart: typeof body.periodStart === "string" ? body.periodStart : null,
    periodEnd: typeof body.periodEnd === "string" ? body.periodEnd : null,
    scope1Tco2e: scope1,
    scope2Tco2e: scope2,
    scope3Tco2e: scope3,
    note: typeof body.note === "string" ? body.note : null,
  };
}

/** Buyer and supplier must be different organisations. */
export function orgsAreDistinct(
  buyerOrganisationId: string,
  supplierOrganisationId: string,
): boolean {
  return (
    Boolean(buyerOrganisationId) &&
    Boolean(supplierOrganisationId) &&
    buyerOrganisationId !== supplierOrganisationId
  );
}

/** Accepting user email must match the invite (case-insensitive). */
export function inviteEmailMatchesUser(inviteEmail: string, userEmail: string): boolean {
  return normalizeInviteEmail(inviteEmail) === normalizeInviteEmail(userEmail);
}
