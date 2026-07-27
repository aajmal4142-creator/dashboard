/**
 * Public token security helpers — pure, testable.
 */

export type TokenSupplierRecord = {
  id: string;
  organisationId: string;
  requestToken: string | null | undefined;
  requestPeriodId: string | null | undefined;
  requestStatus: string | null | undefined;
  requestExpiresAt: string | Date | null | undefined;
};

/** Exact token match only — never enumerate by org or sequential id. */
export function findSupplierByToken(
  records: TokenSupplierRecord[],
  token: string,
): TokenSupplierRecord | null {
  if (!token || token.startsWith("used-")) return null;
  return records.find((r) => r.requestToken === token) ?? null;
}

/**
 * A token for supplier A must not authorise reads/writes for supplier B,
 * another org, or unrelated collections (enforced by only returning the matched row).
 */
export function tokenAuthorizesSupplier(
  matched: TokenSupplierRecord | null,
  targetSupplierId: string,
  targetOrganisationId: string,
): boolean {
  if (!matched) return false;
  return (
    matched.id === targetSupplierId && matched.organisationId === targetOrganisationId
  );
}

export function buildPublicSubmitAuditAfter(input: {
  supplierId: string;
  tokenId: string;
  periodId: string;
  submittedAt: string;
  organisationId: string;
  values: Record<string, number | null | boolean | undefined>;
  isResubmit: boolean;
}): Record<string, unknown> {
  return {
    supplierId: input.supplierId,
    tokenId: input.tokenId,
    periodId: input.periodId,
    submittedAt: input.submittedAt,
    organisationId: input.organisationId,
    isResubmit: input.isResubmit,
    values: input.values,
  };
}
