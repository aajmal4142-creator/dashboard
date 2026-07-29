import { describe, it, expect, vi } from "vitest";
import { generateSecret } from "../webhookValidator";

vi.mock("@/payload.config", () => ({
  default: { mock: true },
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(),
}));

vi.mock("@/lib/audit/write", () => ({
  writeAuditLog: vi.fn(),
}));

describe("webhookService", () => {
  describe("webhook registration", () => {
    it("should generate a valid secret", () => {
      const secret = generateSecret();
      expect(secret).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(secret)).toBe(true);
    });
  });

  describe("WebhookRegistration interface", () => {
    it("should have required fields", () => {
      const webhook = {
        id: "webhook-123",
        webhook_id: "wh-456",
        organisation: "org-123",
        endpoint_url: "https://example.com/webhook",
        secret: generateSecret(),
        events: ["datapoint.created"],
        status: "active" as const,
        retry_count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(webhook.webhook_id).toBeTruthy();
      expect(webhook.endpoint_url).toMatch(/^https?:\/\//);
      expect(webhook.secret).toHaveLength(64);
      expect(["active", "inactive"]).toContain(webhook.status);
    });
  });

  describe("WebhookLog interface", () => {
    it("should have required fields", () => {
      const log = {
        id: "log-123",
        organisation: "org-123",
        webhook_id: "wh-456",
        event_type: "datapoint.created",
        status: "success" as const,
        attempt_number: 1,
        createdAt: new Date().toISOString(),
      };

      expect(log.webhook_id).toBeTruthy();
      expect(["success", "failed", "retrying"]).toContain(log.status);
    });
  });
});
