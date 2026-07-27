import { describe, expect, it } from "vitest";

import { riskOf, sortByDeadlineRisk, type ClientRiskRow } from "./risk";

describe("consultant risk", () => {
  it("flags projected miss as at_risk", () => {
    expect(riskOf(20, 1, 18)).toBe("at_risk");
  });

  it("sorts critical first", () => {
    const rows: ClientRiskRow[] = [
      {
        id: "1",
        name: "A",
        slug: "a",
        sector: "C",
        country: "GB",
        plan: "free",
        daysToFiling: 40,
        datapointsCollected: 10,
        datapointsRequired: 18,
        overallScore: 50,
        risk: "on_track",
      },
      {
        id: "2",
        name: "B",
        slug: "b",
        sector: "C",
        country: "GB",
        plan: "pro",
        daysToFiling: 10,
        datapointsCollected: 2,
        datapointsRequired: 18,
        overallScore: 20,
        risk: "critical",
      },
    ];
    expect(sortByDeadlineRisk(rows)[0]?.id).toBe("2");
  });
});
