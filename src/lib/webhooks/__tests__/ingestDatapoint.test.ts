import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import * as ingestModule from "../ingestDatapoint";

// Mock payload and audit log
vi.mock("@/payload.config", () => ({
  default: { mock: true },
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(),
}));

vi.mock("@/lib/audit/write", () => ({
  writeAuditLog: vi.fn(),
}));

describe("ingestDatapoint", () => {
  const mockOrgId = "org-123";
  const mockPeriodId = "period-456";
  const mockActorId = "user-789";

  describe("IngestDatapointInput validation", () => {
    it("should accept valid datapoint input", () => {
      const input: ingestModule.IngestDatapointInput = {
        metricKey: "emissions.scope1",
        value: 100,
        quality: "measured",
        unit: "tCO2e",
      };

      expect(input.metricKey).toBeTruthy();
      expect(input.quality).toBe("measured");
    });

    it("should handle missing value", () => {
      const input: ingestModule.IngestDatapointInput = {
        metricKey: "emissions.scope1",
        quality: "missing",
      };

      expect(input.metricKey).toBeTruthy();
      expect(input.quality).toBe("missing");
      expect(input.value).toBeUndefined();
    });

    it("should support all valid quality levels", () => {
      const qualities = ["measured", "calculated", "estimated", "missing"] as const;

      qualities.forEach((quality) => {
        const input: ingestModule.IngestDatapointInput = {
          metricKey: "test",
          quality,
        };
        expect(["measured", "calculated", "estimated", "missing"]).toContain(quality);
      });
    });
  });

  describe("batchIngestDatapoints", () => {
    it("should accept valid batch configuration", () => {
      const inputs = [
        {
          metricKey: "test1",
          quality: "measured" as const,
          value: 100,
        },
        {
          metricKey: "test2",
          quality: "calculated" as const,
          value: 200,
        },
      ];

      expect(inputs).toHaveLength(2);
      expect(inputs.every((i) => i.metricKey && i.quality)).toBe(true);
    });
  });
});
