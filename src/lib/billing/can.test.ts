import { describe, expect, it } from "vitest";

import { can, limits } from "./can";
import { normalizePlan } from "./plans";

describe("billing can()", () => {
  it("denies paid features on free", () => {
    expect(can("free", "unwatermarked_pdf")).toBe(false);
    expect(can("free", "evidence_vault")).toBe(false);
    expect(can("free", "white_label")).toBe(false);
    expect(can("free", "bulk_actions")).toBe(false);
  });

  it("allows Pro base entitlements", () => {
    expect(can("pro", "unwatermarked_pdf")).toBe(true);
    expect(can("pro", "unlimited_periods")).toBe(true);
    expect(can("pro", "evidence_vault")).toBe(true);
    expect(can("pro", "white_label")).toBe(false);
  });

  it("allows Consultant channel entitlements", () => {
    expect(can("consultant", "white_label")).toBe(true);
    expect(can("consultant", "bulk_actions")).toBe(true);
    expect(can("consultant", "consultant_cc")).toBe(true);
  });

  it("normalises unknown plans to free", () => {
    expect(normalizePlan("enterprise")).toBe("free");
    expect(limits(undefined).maxSuppliers).toBe(3);
    expect(limits("pro").maxSuppliers).toBe(10);
    expect(limits("consultant").maxClients).toBe(10);
  });
});
