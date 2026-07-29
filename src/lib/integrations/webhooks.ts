import { randomUUID } from "crypto";
import type { Payload } from "payload";

import { generateSecret } from "@/lib/webhooks/webhookValidator";
import type { WebhookConfig, WebhookEvent, WebhookTemplate, SyncResult } from "./types";

function orgIdFromRelation(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}

export class WebhookManager {
  constructor(private payload: Payload) {}

  /**
   * Register a webhook
   */
  async registerWebhook(organisationId: string, config: WebhookConfig): Promise<string> {
    const webhook = await this.payload.create({
      collection: "webhook-registrations",
      data: {
        organisation: organisationId,
        webhook_id: randomUUID(),
        endpoint_url: config.url,
        secret: generateSecret(),
        events: config.events,
        status: config.active ? "active" : "inactive",
        retry_count: 0,
        retry_policy: config.retryPolicy,
        headers: config.headers ?? null,
        authentication: config.authentication ?? null,
      },
      overrideAccess: true,
    });

    return webhook.id;
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<boolean> {
    const webhook = await this.payload.findByID({
      collection: "webhook-registrations",
      id: webhookId,
      overrideAccess: true,
    });

    if (!webhook?.endpoint_url) {
      return false;
    }

    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: { message: "Test webhook" },
    };

    try {
      const response = await fetch(webhook.endpoint_url, {
        method: "POST",
        headers: this.buildHeaders(webhook),
        body: JSON.stringify(testPayload),
      });

      const success = response.ok;

      await this.payload.update({
        collection: "webhook-registrations",
        id: webhookId,
        data: {
          last_triggered_at: new Date().toISOString(),
          retry_count: success ? 0 : (webhook.retry_count || 0) + 1,
        },
        overrideAccess: true,
      });

      return success;
    } catch {
      return false;
    }
  }

  /**
   * Send webhook event
   */
  async sendWebhookEvent(
    event: WebhookEvent,
    data: Record<string, unknown>,
    organisationId: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;

    try {
      const webhooks = await this.payload.find({
        collection: "webhook-registrations",
        where: {
          organisation: {
            equals: organisationId,
          },
          status: {
            equals: "active",
          },
        },
        limit: 1000,
        overrideAccess: true,
      });

      const payload = {
        event,
        timestamp: new Date().toISOString(),
        organisationId,
        data,
      };

      for (const webhook of webhooks.docs) {
        const events = Array.isArray(webhook.events)
          ? (webhook.events as WebhookEvent[])
          : [];
        if (!events.includes(event)) {
          continue;
        }

        try {
          const retryPolicy = webhook.retry_policy as
            | {
                maxRetries?: number;
                retryDelayMs?: number;
                exponentialBackoff?: boolean;
              }
            | null
            | undefined;

          await this.sendWithRetry(
            webhook.endpoint_url,
            payload,
            {
              id: webhook.id,
              organisationId: orgIdFromRelation(webhook.organisation),
              webhookId: webhook.webhook_id,
              headers: webhook.headers,
              authentication: webhook.authentication,
            },
            retryPolicy ?? undefined,
          );
          processed += 1;
        } catch (err) {
          const failureCount = (webhook.retry_count || 0) + 1;

          if (failureCount >= 5) {
            await this.payload.update({
              collection: "webhook-registrations",
              id: webhook.id,
              data: {
                status: "inactive",
                retry_count: failureCount,
              },
              overrideAccess: true,
            });
          } else {
            await this.payload.update({
              collection: "webhook-registrations",
              id: webhook.id,
              data: { retry_count: failureCount },
              overrideAccess: true,
            });
          }

          errors.push({
            message: `Webhook delivery failed: ${String(err)}`,
            recordId: webhook.id,
          });
        }
      }

      return {
        status: errors.length === 0 ? "success" : "partial",
        recordsProcessed: processed,
        recordsFailed: errors.length,
        errors,
        details: {
          event,
          webhooksTriggered: processed,
          webhooksFailed: errors.length,
        },
        syncDurationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ message: errorMsg });
      return {
        status: "failed",
        recordsProcessed: processed,
        recordsFailed: 1,
        errors,
        details: {},
        syncDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWithRetry(
    url: string,
    payload: Record<string, unknown>,
    webhook: {
      id: string;
      organisationId: string;
      webhookId: string;
      headers?: unknown;
      authentication?: unknown;
    },
    retryPolicy?: {
      maxRetries?: number;
      retryDelayMs?: number;
      exponentialBackoff?: boolean;
    },
  ): Promise<void> {
    const maxRetries = retryPolicy?.maxRetries ?? 3;
    const initialDelay = retryPolicy?.retryDelayMs ?? 1000;
    const exponentialBackoff = retryPolicy?.exponentialBackoff ?? true;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: this.buildHeaders(webhook),
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await this.logWebhookDelivery(
            webhook,
            "success",
            null,
            response.status,
            attempt + 1,
          );
          return;
        }

        if (response.status >= 400 && response.status < 500) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          const delay = exponentialBackoff
            ? initialDelay * Math.pow(2, attempt)
            : initialDelay;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    await this.logWebhookDelivery(
      webhook,
      "failed",
      lastError?.message || "Unknown error",
      null,
      maxRetries + 1,
    );
    throw lastError || new Error("Webhook delivery failed after retries");
  }

  /**
   * Log webhook delivery
   */
  private async logWebhookDelivery(
    webhook: {
      organisationId: string;
      webhookId: string;
    },
    status: "success" | "failed" | "retrying",
    error: string | null,
    responseCode: number | null,
    attemptNumber: number,
  ): Promise<void> {
    try {
      await this.payload.create({
        collection: "webhook-logs",
        data: {
          organisation: webhook.organisationId,
          webhook_id: webhook.webhookId,
          event_type: "delivery",
          status,
          response_code: responseCode,
          error_message: error,
          attempt_number: attemptNumber,
        },
        overrideAccess: true,
      });
    } catch {
      // Silently fail logging
    }
  }

  /**
   * Build headers for webhook request
   */
  private buildHeaders(webhook: {
    headers?: unknown;
    authentication?: unknown;
  }): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "ClearESG/1.0",
    };

    const customHeaders = webhook.headers as Record<string, string> | null;
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    const auth = webhook.authentication as
      | {
          type?: string;
          value?: string;
          apiKeyHeader?: string;
          username?: string;
          password?: string;
        }
      | null
      | undefined;

    if (auth) {
      if (auth.type === "bearer" && auth.value) {
        headers["Authorization"] = `Bearer ${auth.value}`;
      } else if (auth.type === "apikey" && auth.value && auth.apiKeyHeader) {
        headers[auth.apiKeyHeader] = auth.value;
      } else if (auth.type === "basic" && auth.username && auth.password) {
        const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString(
          "base64",
        );
        headers["Authorization"] = `Basic ${encoded}`;
      }
    }

    return headers;
  }

  /**
   * Get webhook templates for Zapier/Make
   */
  getWebhookTemplates(): WebhookTemplate[] {
    return [
      {
        name: "Zapier - New Datapoint",
        provider: "zapier",
        events: ["data.created"],
        mapping: {
          event: "event",
          timestamp: "timestamp",
          dataId: "data.id",
          metricKey: "data.metricKey",
          value: "data.value",
          unit: "data.unit",
        },
        description: "Trigger Zapier workflows when new datapoints are created",
      },
      {
        name: "Make - Emissions Alert",
        provider: "make",
        events: ["alert.triggered"],
        mapping: {
          event: "event",
          timestamp: "timestamp",
          alertLevel: "data.level",
          message: "data.message",
          affectedMetrics: "data.metrics",
        },
        description: "Send alerts to Make.com when emissions thresholds are exceeded",
      },
      {
        name: "Zapier - Report Generated",
        provider: "zapier",
        events: ["report.generated"],
        mapping: {
          event: "event",
          timestamp: "timestamp",
          reportId: "data.reportId",
          reportType: "data.type",
          reportUrl: "data.downloadUrl",
        },
        description: "Trigger workflows when reports are generated",
      },
      {
        name: "Make - Data Sync Complete",
        provider: "make",
        events: ["sync.completed"],
        mapping: {
          event: "event",
          timestamp: "timestamp",
          syncProvider: "data.provider",
          recordsProcessed: "data.recordsProcessed",
          status: "data.status",
        },
        description: "Monitor data sync completions across integrations",
      },
    ];
  }

  /**
   * Update webhook configuration
   */
  async updateWebhookConfig(
    webhookId: string,
    config: Partial<WebhookConfig>,
  ): Promise<void> {
    const data: Record<string, unknown> = {};

    if (config.url !== undefined) data.endpoint_url = config.url;
    if (config.events !== undefined) data.events = config.events;
    if (config.active !== undefined) data.status = config.active ? "active" : "inactive";
    if (config.retryPolicy !== undefined) data.retry_policy = config.retryPolicy;
    if (config.headers !== undefined) data.headers = config.headers;
    if (config.authentication !== undefined) data.authentication = config.authentication;

    await this.payload.update({
      collection: "webhook-registrations",
      id: webhookId,
      data,
      overrideAccess: true,
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.payload.delete({
      collection: "webhook-registrations",
      id: webhookId,
      overrideAccess: true,
    });
  }

  /**
   * List webhooks for organisation
   */
  async listWebhooks(organisationId: string): Promise<Record<string, unknown>[]> {
    const webhooks = await this.payload.find({
      collection: "webhook-registrations",
      where: {
        organisation: {
          equals: organisationId,
        },
      },
      limit: 1000,
      overrideAccess: true,
    });

    return webhooks.docs.map((doc) => ({
      id: doc.id,
      webhook_id: doc.webhook_id,
      organisation: orgIdFromRelation(doc.organisation),
      endpoint_url: doc.endpoint_url,
      events: doc.events,
      status: doc.status,
      retry_count: doc.retry_count,
      retry_policy: doc.retry_policy,
      headers: doc.headers,
      authentication: doc.authentication,
      last_triggered_at: doc.last_triggered_at,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }
}
