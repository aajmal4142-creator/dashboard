import { describe, expect, it } from "vitest";

import {
  buildPublicSubmitAuditAfter,
  findSupplierByToken,
  tokenAuthorizesSupplier,
} from "./tokenSecurity";

const orgA = "org_a";
const orgB = "org_b";

const suppliers = [
  {
    id: "sup_a",
    organisationId: orgA,
    requestToken: "token_aaaa",
    requestPeriodId: "per_1",
    requestStatus: "sent",
    requestExpiresAt: "2099-01-01",
  },
  {
    id: "sup_b",
    organisationId: orgA,
    requestToken: "token_bbbb",
    requestPeriodId: "per_1",
    requestStatus: "sent",
    requestExpiresAt: "2099-01-01",
  },
  {
    id: "sup_c",
    organisationId: orgB,
    requestToken: "token_cccc",
    requestPeriodId: "per_2",
    requestStatus: "sent",
    requestExpiresAt: "2099-01-01",
  },
];

describe("token isolation", () => {
  it("token for supplier A cannot resolve supplier B", () => {
    const matched = findSupplierByToken(suppliers, "token_aaaa");
    expect(matched?.id).toBe("sup_a");
    expect(tokenAuthorizesSupplier(matched, "sup_b", orgA)).toBe(false);
    expect(tokenAuthorizesSupplier(matched, "sup_a", orgA)).toBe(true);
  });

  it("token for org A supplier cannot authorise org B", () => {
    const matched = findSupplierByToken(suppliers, "token_aaaa");
    expect(tokenAuthorizesSupplier(matched, "sup_a", orgB)).toBe(false);
    expect(tokenAuthorizesSupplier(matched, "sup_c", orgB)).toBe(false);
  });

  it("unknown or invalidated tokens resolve to null", () => {
    expect(findSupplierByToken(suppliers, "nope")).toBeNull();
    expect(findSupplierByToken(suppliers, "used-sup_a-1")).toBeNull();
    expect(tokenAuthorizesSupplier(null, "sup_a", orgA)).toBe(false);
  });

  it("audit after payload is reconstructable for an auditor", () => {
    const after = buildPublicSubmitAuditAfter({
      supplierId: "sup_a",
      tokenId: "token_aaaa",
      periodId: "per_1",
      submittedAt: "2026-07-22T12:00:00.000Z",
      organisationId: orgA,
      values: { estimated_tco2e: 12, is_metered: false },
      isResubmit: false,
    });
    expect(after.supplierId).toBe("sup_a");
    expect(after.tokenId).toBe("token_aaaa");
    expect(after.periodId).toBe("per_1");
    expect(after.submittedAt).toBe("2026-07-22T12:00:00.000Z");
    expect(after.organisationId).toBe(orgA);
  });
});
