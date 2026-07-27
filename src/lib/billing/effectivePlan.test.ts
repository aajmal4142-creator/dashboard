import { describe, expect, it } from "vitest";

import { can } from "./can";
import { isPlanFrozen, resolveEffectivePlan } from "./effectivePlan";

describe("resolveEffectivePlan", () => {
  it("keeps active pro", () => {
    expect(resolveEffectivePlan({ plan: "pro", subscriptionStatus: "active" })).toBe(
      "pro",
    );
  });

  it("freezes past_due to free entitlements", () => {
    expect(resolveEffectivePlan({ plan: "pro", subscriptionStatus: "past_due" })).toBe(
      "free",
    );
    expect(isPlanFrozen("past_due")).toBe(true);
  });

  it("past_due loses clean PDF but can still be checked for watermark", () => {
    const effective = resolveEffectivePlan({
      plan: "pro",
      subscriptionStatus: "past_due",
    });
    expect(can(effective, "unwatermarked_pdf")).toBe(false);
  });
});
