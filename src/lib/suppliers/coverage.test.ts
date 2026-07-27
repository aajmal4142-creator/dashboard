import { describe, expect, it } from "vitest";

import { responseRatePct, spendCoveragePct } from "./coverage";

describe("spendCoveragePct", () => {
  it("returns null when no positive spend", () => {
    expect(spendCoveragePct([{ annualSpend: 0, requestStatus: "submitted" }])).toBeNull();
    expect(spendCoveragePct([])).toBeNull();
  });

  it("weights by spend", () => {
    expect(
      spendCoveragePct([
        { annualSpend: 80_000, requestStatus: "submitted" },
        { annualSpend: 20_000, requestStatus: "sent" },
      ]),
    ).toBe(80);
  });
});

describe("responseRatePct", () => {
  it("counts submitted among contacted", () => {
    expect(
      responseRatePct([
        { requestStatus: "not_sent" },
        { requestStatus: "sent" },
        { requestStatus: "submitted" },
      ]),
    ).toBe(50);
  });
});
