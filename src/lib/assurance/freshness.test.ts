import { describe, expect, it } from "vitest";

import { evidenceFreshness } from "./freshness";
import { buildFigureLineage, evidenceLinkState, resolvePinnedFactor } from "./lineage";

describe("evidenceFreshness", () => {
  it("unknown when coverage unset — never green pass", () => {
    expect(
      evidenceFreshness({
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }).state,
    ).toBe("unknown");
  });

  it("mismatch when no overlap", () => {
    expect(
      evidenceFreshness({
        coverageStart: "2023-01-01",
        coverageEnd: "2023-06-30",
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }).state,
    ).toBe("mismatch");
  });

  it("ok when overlaps", () => {
    expect(
      evidenceFreshness({
        coverageStart: "2025-01-01",
        coverageEnd: "2025-03-31",
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }).state,
    ).toBe("ok");
  });
});

describe("evidenceLinkState", () => {
  it("unverified without bidirectional link", () => {
    expect(
      evidenceLinkState({
        datapointId: "dp1",
        datapointEvidenceIds: [],
        evidenceDocs: [{ id: "ev1", linkedDatapointIds: ["dp1"] }],
      }),
    ).toBe("unverified");
  });

  it("verified only when both sides link", () => {
    expect(
      evidenceLinkState({
        datapointId: "dp1",
        datapointEvidenceIds: ["ev1"],
        evidenceDocs: [{ id: "ev1", linkedDatapointIds: ["dp1"] }],
      }),
    ).toBe("verified");
  });
});

describe("resolvePinnedFactor", () => {
  const pins = [
    {
      factorId: "f1",
      key: "grid_electricity",
      value: 0.2,
      source: "DEFRA",
      year: 2024,
    },
  ];

  it("resolves by pinned factorId from snapshot", () => {
    const r = resolvePinnedFactor({
      datapointFactorId: "f1",
      factorsUsed: pins,
    });
    expect(r.factor?.factorId).toBe("f1");
    expect(r.reason).toBeNull();
  });

  it("resolves by factor registry key when metricKey differs", () => {
    const r = resolvePinnedFactor({
      factorsUsed: pins,
      metricKey: "diesel_litres",
      factorRegistryKey: "grid_electricity",
    });
    expect(r.factor?.key).toBe("grid_electricity");
  });

  it("never invents a factor when pin missing", () => {
    const r = resolvePinnedFactor({
      datapointFactorId: "missing",
      factorsUsed: pins,
      metricKey: "grid_electricity",
    });
    expect(r.factor).toBeNull();
  });
});

describe("buildFigureLineage", () => {
  it("marks legacy soft-match as unverified", () => {
    const lineage = buildFigureLineage({
      datapointId: "dp1",
      metricKey: "electricity_kwh",
      value: 100,
      quality: "measured",
      datapointEvidenceIds: [],
      evidenceDocs: [
        {
          id: "ev1",
          filename: "bill.pdf",
          sha256: "abc",
          uploadedAt: "2025-01-01",
          linkedDatapointIds: [],
        },
      ],
      factorsUsed: [],
    });
    expect(lineage.evidenceLink).toBe("unverified");
  });
});
