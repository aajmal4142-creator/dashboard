import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookManager } from "./webhooks";
import type { Payload } from "payload";
import type { WebhookConfig, WebhookEvent } from "./types";

describe("WebhookManager", () => {
  let webhookManager: WebhookManager;
  let mockPayload: Partial<Payload>;

  beforeEach(() => {
    mockPayload = {
      create: vi.fn().mockResolvedValue({ id: "webhook-1" }),
      findByID: vi.fn().mockResolvedValue({
        id: "webhook-1",
        webhook_id: "wh-1",
        organisation: "org-1",
        endpoint_url: "https://example.com/webhook",
        events: ["data.created", "data.updated"],
        status: "active",
        retry_policy: {
          maxRetries: 3,
          retryDelayMs: 1000,
          exponentialBackoff: true,
        },
        retry_count: 0,
      }),
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            id: "webhook-1",
            webhook_id: "wh-1",
            organisation: "org-1",
            endpoint_url: "https://example.com/webhook",
            events: ["data.created"],
            status: "active",
            retry_policy: {
              maxRetries: 3,
              retryDelayMs: 1000,
              exponentialBackoff: true,
            },
            retry_count: 0,
          },
        ],
      }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    };

    webhookManager = new WebhookManager(mockPayload as Payload);
  });

  it("should register a webhook", async () => {
    const config: WebhookConfig = {
      url: "https://example.com/webhook",
      events: ["data.created"],
      active: true,
      retryPolicy: {
        maxRetries: 3,
        retryDelayMs: 1000,
        exponentialBackoff: true,
      },
    };

    const webhookId = await webhookManager.registerWebhook("org-1", config);

    expect(webhookId).toBe("webhook-1");
    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "webhook-registrations",
      }),
    );
  });

  it("should test webhook delivery", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

    const success = await webhookManager.testWebhook("webhook-1");

    expect(success).toBe(true);
    expect(mockPayload.update).toHaveBeenCalled();
  });

  it("should send webhook event to registered webhooks", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ received: true }), { status: 200 }),
      );

    const result = await webhookManager.sendWebhookEvent(
      "data.created" as WebhookEvent,
      { id: "dp-1", value: 100 },
      "org-1",
    );

    expect(result.status).toBe("success");
    expect(result.recordsProcessed).toBeGreaterThan(0);
  });

  it("should get webhook templates", () => {
    const templates = webhookManager.getWebhookTemplates();

    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0].name).toBeDefined();
  });

  it("should update webhook config", async () => {
    await webhookManager.updateWebhookConfig("webhook-1", {
      url: "https://example.com/updated",
      active: false,
    });

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "webhook-registrations",
        id: "webhook-1",
      }),
    );
  });

  it("should delete webhook", async () => {
    await webhookManager.deleteWebhook("webhook-1");

    expect(mockPayload.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "webhook-registrations",
        id: "webhook-1",
      }),
    );
  });
});
