import { describe, expect, it } from "vitest";

import { detectAnomalies } from "@/lib/governance/anomalies";
import { rankGaps } from "@/lib/governance/gaps";
import {
  mayEnablePaidBilling,
  mayPublishReports,
  isProductionRuntime,
} from "@/lib/launch/gates";

describe("rankGaps", () => {
  it("ranks missing metrics by impact×ease", () => {
    const { missing, collected, total } = rankGaps(new Set(["electricity_kwh"]));
    expect(collected).toBe(1);
    expect(total).toBeGreaterThan(1);
    expect(missing[0]?.rank).toBeGreaterThanOrEqual(missing[1]?.rank ?? 0);
  });
});

describe("detectAnomalies", () => {
  it("flags median outliers when cohort n≥8", () => {
    const flags = detectAnomalies([
      {
        metricKey: "electricity_kwh",
        value: 1_000_000,
        evidenceCount: 0,
        cohortMedian: 100_000,
        cohortSize: 8,
      },
    ]);
    expect(flags.some((f) => f.metricKey === "electricity_kwh")).toBe(true);
  });

  it("flags period change without evidence", () => {
    const flags = detectAnomalies([
      {
        metricKey: "diesel_litres",
        value: 200,
        priorValue: 100,
        evidenceCount: 0,
      },
    ]);
    expect(flags.length).toBeGreaterThan(0);
  });
});

describe("launch gates", () => {
  it("exposes mayEnablePaidBilling / mayPublishReports helpers", () => {
    expect(typeof mayEnablePaidBilling()).toBe("boolean");
    expect(typeof mayPublishReports()).toBe("boolean");
    expect(typeof isProductionRuntime()).toBe("boolean");
  });
});
