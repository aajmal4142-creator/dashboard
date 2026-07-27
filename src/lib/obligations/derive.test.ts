/**
 * Unit tests for the obligation rules engine.
 * Thresholds are placeholders — tests lock intended product behaviour.
 */

import { describe, expect, it } from "vitest";

import {
  baselineFiguresEqual,
  deriveObligations,
  hasBaselineDrift,
  headcountAtLarge,
  headcountJustUnderLarge,
  parseRevenueBand,
  shouldSkipEngineWrite,
} from "./index";

const AS_OF = "2026-07-22";

describe("deriveObligations — CSRD", () => {
  it("marks an EU large undertaking as CSRD Wave 2 with a derived date + reason", () => {
    const { obligations, voluntary } = deriveObligations({
      country: "DE",
      employeeCount: 300,
      revenueBand: "50_250m",
      asOf: AS_OF,
    });
    expect(voluntary).toBe(false);
    expect(obligations).toHaveLength(1);
    const o = obligations[0]!;
    expect(o.name).toBe("CSRD Wave 2");
    expect(o.wave).toBe("2");
    expect(o.jurisdiction).toBe("EU");
    expect(o.standardVersion).toBe("CSRD_SIMPLIFIED");
    expect(o.filingDeadline).toBe("2028-06-30");
    expect(o.firstReportingFY).toBe("FY2027");
    expect(o.confidence).toBe("needs_confirmation");
    expect(o.reason).toMatch(/CSRD Wave 2/);
    expect(o.reason).toMatch(/DE/);
    expect(o.derivedInputs.country).toBe("DE");
    expect(o.derivedInputs.headcount).toBe(300);
    expect(o.derivedInputs.revenueBand).toBe("50_250m");
    expect(o.derivedInputs.asOf).toBe(AS_OF);
  });

  it("flips correctly at the headcount threshold boundary", () => {
    const under = deriveObligations({
      country: "IE",
      employeeCount: headcountJustUnderLarge(),
      revenueBand: "10_50m",
      asOf: AS_OF,
    });
    expect(under.voluntary).toBe(true);
    expect(under.obligations[0]!.filingDeadline).toBeNull();

    const at = deriveObligations({
      country: "IE",
      employeeCount: headcountAtLarge(),
      revenueBand: "10_50m",
      asOf: AS_OF,
    });
    expect(at.voluntary).toBe(false);
    expect(at.obligations[0]!.wave).toBe("2");
    expect(at.obligations[0]!.filingDeadline).toBe("2028-06-30");
  });

  it("treats large turnover alone as in-scope even under headcount line", () => {
    const { obligations, voluntary } = deriveObligations({
      country: "NL",
      employeeCount: 80,
      revenueBand: "gt_250m",
      asOf: AS_OF,
    });
    expect(voluntary).toBe(false);
    expect(obligations[0]!.wave).toBe("2");
  });
});

describe("deriveObligations — BRSR", () => {
  it("returns a BRSR candidate that requires listing confirmation", () => {
    const { obligations, voluntary } = deriveObligations({
      country: "IN",
      employeeCount: 500,
      revenueBand: "gt_250m",
      asOf: AS_OF,
    });
    expect(voluntary).toBe(false);
    const o = obligations[0]!;
    expect(o.wave).toBe("brsr_listed");
    expect(o.standardVersion).toBe("BRSR");
    expect(o.filingDeadline).toBe("2026-06-30");
    expect(o.confidence).toBe("needs_confirmation");
    expect(o.reason).toMatch(/listed/i);
    expect(o.reason).toMatch(/cannot confirm your listing status/i);
    expect(o.reason).toMatch(/size does not determine/i);
  });
});

describe("deriveObligations — voluntary", () => {
  it("returns voluntary with no deadline for GB (never brsr_supply on size)", () => {
    const { obligations, voluntary } = deriveObligations({
      country: "GB",
      employeeCount: 400,
      revenueBand: "gt_250m",
      asOf: AS_OF,
    });
    expect(voluntary).toBe(true);
    const o = obligations[0]!;
    expect(o.wave).toBe("other");
    expect(o.filingDeadline).toBeNull();
    expect(o.standardVersion).toBe("VSME");
    expect(o.reason).toMatch(/buyers may still/i);
    expect(o.wave).not.toBe("brsr_supply");
  });

  it("returns voluntary with no deadline for US", () => {
    const { obligations, voluntary } = deriveObligations({
      country: "US",
      employeeCount: 1000,
      revenueBand: "gt_250m",
      asOf: AS_OF,
    });
    expect(voluntary).toBe(true);
    expect(obligations[0]!.filingDeadline).toBeNull();
    expect(obligations[0]!.wave).not.toBe("brsr_supply");
  });

  it("never fabricates a deadline for EU orgs under the size line", () => {
    const { obligations, voluntary } = deriveObligations({
      country: "DE",
      employeeCount: 80,
      revenueBand: "2_10m",
      asOf: AS_OF,
    });
    expect(voluntary).toBe(true);
    expect(obligations[0]!.filingDeadline).toBeNull();
  });
});

describe("baseline drift helpers", () => {
  it("detects when baseline figures diverge from a stored snapshot", () => {
    const stored = {
      country: "DE",
      headcount: 300,
      revenueBand: "50_250m" as const,
      asOf: AS_OF,
    };
    expect(
      hasBaselineDrift(stored, {
        country: "DE",
        employeeCount: 300,
        revenueBand: "50_250m",
      }),
    ).toBe(false);
    expect(
      hasBaselineDrift(stored, {
        country: "DE",
        employeeCount: 400,
        revenueBand: "50_250m",
      }),
    ).toBe(true);
  });

  it("compares figures ignoring asOf via baselineFiguresEqual", () => {
    expect(
      baselineFiguresEqual(
        { country: "gb", headcount: 10, revenueBand: "lt_2m" },
        { country: "GB", headcount: 10, revenueBand: "lt_2m" },
      ),
    ).toBe(true);
  });

  it("parseRevenueBand accepts only known bands", () => {
    expect(parseRevenueBand("50_250m")).toBe("50_250m");
    expect(parseRevenueBand("nope")).toBeNull();
  });
});

describe("shouldSkipEngineWrite", () => {
  it("keeps manual overrides sticky unless force is set", () => {
    expect(shouldSkipEngineWrite({ source: "manual" }, false)).toBe(true);
    expect(shouldSkipEngineWrite({ source: "manual" }, true)).toBe(false);
    expect(shouldSkipEngineWrite({ source: "engine" }, false)).toBe(false);
    expect(shouldSkipEngineWrite(null, false)).toBe(false);
  });
});
