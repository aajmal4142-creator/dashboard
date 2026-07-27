import { describe, expect, it } from "vitest";

import { can } from "@/lib/billing/can";
import { resolveEffectivePlan } from "@/lib/billing/effectivePlan";
import {
  mayEnablePaidBilling,
  mayPublishBenchmarkCohorts,
  maySeedBenchmarkDemo,
} from "@/lib/launch/gates";
import {
  utilityConnectionStatus,
  utilityFillProvenance,
} from "@/lib/integrations/utility";

describe("past_due never blocks publish semantics", () => {
  it("past_due org loses clean PDF but retains Free-grade access (watermark only)", () => {
    const effective = resolveEffectivePlan({
      plan: "pro",
      subscriptionStatus: "past_due",
    });
    expect(effective).toBe("free");
    expect(can(effective, "unwatermarked_pdf")).toBe(false);
    // Publish is not gated by plan/entitlement — only disclaimer gate (separate).
    // Watermarked download remains available for Free entitlements.
    expect(can(effective, "evidence_vault")).toBe(false);
  });
});

describe("launch gates", () => {
  it("live billing and cohorts off by default in test env", () => {
    expect(mayEnablePaidBilling()).toBe(false);
    expect(mayPublishBenchmarkCohorts()).toBe(false);
    expect(maySeedBenchmarkDemo()).toBe(false);
  });
});

describe("utility integration scaffold", () => {
  it("is unavailable without credentials — never fakes data", () => {
    expect(utilityConnectionStatus().status).toBe("unavailable");
    const p = utilityFillProvenance("acme-utility");
    expect(p.quality).not.toBe("measured");
    expect(p.source).toBe("api");
  });
});
