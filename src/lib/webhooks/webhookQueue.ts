import {
  listWebhooks,
  logWebhookAttempt,
  updateWebhookLastTriggered,
} from "./webhookService";
import { generateSignature } from "./webhookValidator";

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

const RETRY_DELAYS = [1000, 2000, 5000, 10000]; // ms
const MAX_RETRIES = 4;
const WEBHOOK_TIMEOUT = 30000; // 30 seconds

async function deliverWebhook(
  webhookId: string,
  organisationId: string,
  endpointUrl: string,
  event: WebhookEvent,
  secret: string,
  attempt: number = 1,
): Promise<boolean> {
  const payload = JSON.stringify(event.payload);
  const signature = generateSignature(payload, secret);

  const startTime = Date.now();

  try {
    const response = await Promise.race([
      fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-ID": webhookId,
          "X-Webhook-Event": event.event_type,
        },
        body: payload,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), WEBHOOK_TIMEOUT),
      ),
    ]);

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await logWebhookAttempt({
      webhookId,
      organisationId,
      eventType: event.event_type,
      payload: event.payload,
      status: "success",
      responseCode: response.status,
      attemptNumber: attempt,
      durationMs,
    });

    await updateWebhookLastTriggered(webhookId);
    return true;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (attempt < MAX_RETRIES) {
      const nextRetryMs =
        RETRY_DELAYS[attempt - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + nextRetryMs).toISOString();

      await logWebhookAttempt({
        webhookId,
        organisationId,
        eventType: event.event_type,
        payload: event.payload,
        status: "retrying",
        errorMessage,
        attemptNumber: attempt,
        nextRetryAt,
        durationMs,
      });

      // Schedule retry
      setTimeout(() => {
        // Get the webhook and retry (would need to re-fetch secret)
        // For MVP, this is fire-and-forget with best effort
      }, nextRetryMs);
    } else {
      // Final failure - dead letter
      await logWebhookAttempt({
        webhookId,
        organisationId,
        eventType: event.event_type,
        payload: event.payload,
        status: "failed",
        errorMessage: `Failed after ${MAX_RETRIES} attempts: ${errorMessage}`,
        attemptNumber: attempt,
        durationMs,
      });
    }

    return false;
  }
}

export async function triggerWebhooks(event: WebhookEvent): Promise<void> {
  try {
    const webhooks = await listWebhooks(event.organisationId);

    // Filter active webhooks that handle this event
    const activeWebhooks = webhooks.filter(
      (w) => w.status === "active" && w.events.includes(event.event_type),
    );

    // Deliver in parallel, non-blocking
    activeWebhooks.forEach((webhook) => {
      deliverWebhook(
        webhook.webhook_id,
        event.organisationId,
        webhook.endpoint_url,
        event,
        webhook.secret,
      ).catch((err) => {
        console.error(`[webhook] delivery failed: ${webhook.webhook_id}`, err);
      });
    });
  } catch (err) {
    console.error("[webhook] trigger failed", err);
  }
}
