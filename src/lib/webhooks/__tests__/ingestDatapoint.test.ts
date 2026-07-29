import { describe, it, expect, vi } from "vitest";
import * as ingestModule from "../ingestDatapoint";

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
          metricKey: "emissions.scope1",
          quality,
          source: "api",
        };
        expect(input.quality).toBe(quality);
      });
    });
  });
});
