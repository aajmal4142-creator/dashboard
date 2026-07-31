import {
  getWebhook,
  listWebhooks,
  logWebhookAttempt,
  updateWebhookLastTriggered,
  type WebhookRegistration,
} from "./webhookService";
import {
  buildOutboundHeaders,
  deliverWithRetry,
  parseCustomHeaders,
  parseOutboundAuth,
  sanitizePayloadForLog,
  type DeliveryAttemptResult,
} from "./reportDelivery";
import {
  DEFAULT_WEBHOOK_TIMEOUT_MS,
  isDeadLetterStatus,
  resolveRetryPolicy,
} from "./retrySchedule";

export interface WebhookEvent {
  event_type: "datapoint.created" | "datapoint.updated";
  organisationId: string;
  payload: {
    datapoint_id: string;
    metricKey: string;
    value?: number | null;
    quality: "measured" | "calculated" | "estimated" | "missing";
    timestamp: string;
  };
}

async function httpPostJson(args: {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
}): Promise<DeliveryAttemptResult> {
  const start = Date.now();
  const timeoutMs = args.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;
  try {
    const response = await Promise.race([
      fetch(args.url, {
        method: "POST",
        headers: args.headers,
        body: args.body,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs),
      ),
    ]);
    const durationMs = Date.now() - start;
    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        errorMessage: `HTTP ${response.status}`,
        durationMs,
      };
    }
    return {
      ok: true,
      statusCode: response.status,
      durationMs,
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Deliver a payload to one registration with policy-driven retries + attempt logs.
 */
export async function deliverToWebhook(args: {
  webhook: WebhookRegistration;
  organisationId: string;
  eventType: string;
  payload: unknown;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ success: boolean; attempts: number }> {
  const policy = resolveRetryPolicy(args.webhook.retry_policy);
  const body = JSON.stringify(args.payload);
  const customHeaders = parseCustomHeaders(args.webhook.headers);
  const authentication = parseOutboundAuth(args.webhook.authentication);
  const logSafePayload = sanitizePayloadForLog(args.payload);

  return deliverWithRetry({
    policy,
    sleep: args.sleep,
    attempt: async () => {
      const headers = buildOutboundHeaders({
        webhookId: args.webhook.webhook_id,
        eventType: args.eventType,
        secret: args.webhook.secret,
        body,
        customHeaders,
        authentication,
      });
      return httpPostJson({
        url: args.webhook.endpoint_url,
        headers,
        body,
      });
    },
    onAttempt: async (log) => {
      await logWebhookAttempt({
        webhookId: args.webhook.webhook_id,
        organisationId: args.organisationId,
        eventType: args.eventType,
        payload: logSafePayload,
        status: log.status,
        responseCode: log.statusCode,
        errorMessage: log.errorMessage,
        attemptNumber: log.attemptNumber,
        nextRetryAt: log.nextRetryAt,
        durationMs: log.durationMs,
        source: "webhook",
      });
      if (log.status === "success") {
        await updateWebhookLastTriggered(args.webhook.webhook_id);
      }
    },
  });
}

/** @deprecated Prefer deliverToWebhook — kept for call-site compatibility. */
export async function deliverWebhook(
  webhookId: string,
  organisationId: string,
  endpointUrl: string,
  event: WebhookEvent,
  secret: string,
  _attempt: number = 1,
): Promise<boolean> {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    const synthetic: WebhookRegistration = {
      id: webhookId,
      webhook_id: webhookId,
      organisation: organisationId,
      endpoint_url: endpointUrl,
      secret,
      events: [event.event_type],
      status: "active",
      retry_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await deliverToWebhook({
      webhook: synthetic,
      organisationId,
      eventType: event.event_type,
      payload: event.payload,
    });
    return result.success;
  }
  const result = await deliverToWebhook({
    webhook,
    organisationId,
    eventType: event.event_type,
    payload: event.payload,
  });
  return result.success;
}

export async function triggerWebhooks(event: WebhookEvent): Promise<void> {
  try {
    const webhooks = await listWebhooks(event.organisationId);

    const activeWebhooks = webhooks.filter(
      (w) => w.status === "active" && w.events.includes(event.event_type),
    );

    activeWebhooks.forEach((webhook) => {
      deliverToWebhook({
        webhook,
        organisationId: event.organisationId,
        eventType: event.event_type,
        payload: event.payload,
      }).catch((err) => {
        console.error(`[webhook] delivery failed: ${webhook.webhook_id}`, err);
      });
    });
  } catch (err) {
    console.error("[webhook] trigger failed", err);
  }
}

/**
 * Send a signed test payload to a registered endpoint (with retries).
 */
export async function sendTestWebhookDelivery(args: {
  webhookId: string;
  organisationId: string;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ success: boolean; attempts: number }> {
  const webhook = await getWebhook(args.webhookId);
  if (!webhook) {
    throw new Error("Webhook not found");
  }
  if (webhook.organisation !== args.organisationId) {
    throw new Error("Unauthorized");
  }

  const payload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    webhook_id: webhook.webhook_id,
    message: "ClearESG webhook test delivery",
  };

  return deliverToWebhook({
    webhook,
    organisationId: args.organisationId,
    eventType: "webhook.test",
    payload,
    sleep: args.sleep,
  });
}

/**
 * Replay a dead-letter (failed) delivery using the stored payload.
 */
export async function replayFailedDelivery(args: {
  logId: string;
  organisationId: string;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ success: boolean; attempts: number; webhook_id: string }> {
  const { getPayload } = await import("payload");
  const config = (await import("@/payload.config")).default;
  const payload = await getPayload({ config });

  let log;
  try {
    log = await payload.findByID({
      collection: "webhook-logs",
      id: args.logId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    throw new Error("Delivery log not found");
  }

  const orgId =
    typeof log.organisation === "string"
      ? log.organisation
      : log.organisation &&
          typeof log.organisation === "object" &&
          "id" in log.organisation
        ? String((log.organisation as { id: string }).id)
        : "";

  if (orgId !== args.organisationId) {
    throw new Error("Unauthorized");
  }

  if (!isDeadLetterStatus(log.status)) {
    throw new Error("Only failed (dead-letter) deliveries can be replayed");
  }

  if (log.source === "api") {
    throw new Error("API ingest logs cannot be replayed as outbound webhooks");
  }

  const webhook = await getWebhook(log.webhook_id);
  if (!webhook) {
    throw new Error("Webhook registration no longer exists");
  }
  if (webhook.organisation !== args.organisationId) {
    throw new Error("Unauthorized");
  }

  const eventType =
    typeof log.event_type === "string" ? log.event_type : "webhook.replay";
  const bodyPayload = log.payload ?? { event: "webhook.replay", log_id: args.logId };

  const result = await deliverToWebhook({
    webhook,
    organisationId: args.organisationId,
    eventType,
    payload: bodyPayload,
    sleep: args.sleep,
  });

  return {
    success: result.success,
    attempts: result.attempts,
    webhook_id: webhook.webhook_id,
  };
}
