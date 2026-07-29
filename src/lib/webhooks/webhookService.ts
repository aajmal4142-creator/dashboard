import { getPayload } from "payload";
import { randomUUID } from "crypto";
import config from "@/payload.config";
import { writeAuditLog } from "@/lib/audit/write";
import { generateSecret } from "./webhookValidator";

export interface WebhookRegistration {
  id: string;
  webhook_id: string;
  organisation: string;
  endpoint_url: string;
  secret: string;
  events: string[];
  status: "active" | "inactive";
  last_triggered_at?: string;
  retry_count: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLog {
  id: string;
  organisation: string;
  webhook_id: string;
  event_type: string;
  payload?: unknown;
  status: "success" | "failed" | "retrying";
  response_code?: number;
  error_message?: string;
  attempt_number: number;
  next_retry_at?: string;
  duration_ms?: number;
  createdAt: string;
}

export async function registerWebhook(
  organisationId: string,
  endpoint: string,
  events: string[],
  actorId?: string,
): Promise<WebhookRegistration> {
  const payload = await getPayload({ config });
  const webhookId = randomUUID();
  const secret = generateSecret();

  const webhook = await (
    payload.create as (args: {
      collection: "webhook-registrations";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<WebhookRegistration>
  )({
    collection: "webhook-registrations",
    data: {
      organisation: organisationId,
      webhook_id: webhookId,
      endpoint_url: endpoint,
      secret,
      events,
      status: "active",
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId,
    actorId,
    action: "webhook.registered",
    entityType: "webhook-registrations",
    entityId: webhookId,
    after: { webhook_id: webhookId, endpoint_url: endpoint, events },
  });

  return webhook;
}

export async function listWebhooks(
  organisationId: string,
): Promise<WebhookRegistration[]> {
  const payload = await getPayload({ config });

  const result = await (
    payload.find as (args: {
      collection: "webhook-registrations";
      where: Record<string, unknown>;
      limit: number;
      overrideAccess: true;
    }) => Promise<{ docs: WebhookRegistration[] }>
  )({
    collection: "webhook-registrations",
    where: { organisation: { equals: organisationId } },
    limit: 1000,
    overrideAccess: true,
  });

  return result.docs;
}

export async function getWebhook(webhookId: string): Promise<WebhookRegistration | null> {
  const payload = await getPayload({ config });

  const result = await (
    payload.find as (args: {
      collection: "webhook-registrations";
      where: Record<string, unknown>;
      limit: number;
      overrideAccess: true;
    }) => Promise<{ docs: WebhookRegistration[] }>
  )({
    collection: "webhook-registrations",
    where: { webhook_id: { equals: webhookId } },
    limit: 1,
    overrideAccess: true,
  });

  return result.docs[0] || null;
}

export async function deleteWebhook(
  webhookId: string,
  organisationId: string,
  actorId?: string,
): Promise<void> {
  const payload = await getPayload({ config });

  const webhook = await getWebhook(webhookId);
  if (!webhook) throw new Error("Webhook not found");
  if (webhook.organisation !== organisationId) throw new Error("Unauthorized");

  await (
    payload.delete as (args: {
      collection: "webhook-registrations";
      id: string;
      overrideAccess: true;
    }) => Promise<void>
  )({
    collection: "webhook-registrations",
    id: webhook.id,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId,
    actorId,
    action: "webhook.deleted",
    entityType: "webhook-registrations",
    entityId: webhookId,
    before: { webhook_id: webhookId, endpoint_url: webhook.endpoint_url },
  });
}

export async function rotateSecret(webhookId: string): Promise<string> {
  const payload = await getPayload({ config });

  const webhook = await getWebhook(webhookId);
  if (!webhook) throw new Error("Webhook not found");

  const newSecret = generateSecret();

  await (
    payload.update as (args: {
      collection: "webhook-registrations";
      id: string;
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<WebhookRegistration>
  )({
    collection: "webhook-registrations",
    id: webhook.id,
    data: { secret: newSecret },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: webhook.organisation,
    action: "webhook.secret_rotated",
    entityType: "webhook-registrations",
    entityId: webhookId,
    before: { secret_rotated: true },
  });

  return newSecret;
}

export async function logWebhookAttempt(log: {
  webhookId: string;
  organisationId: string;
  eventType: string;
  payload?: unknown;
  status: "success" | "failed" | "retrying";
  responseCode?: number;
  errorMessage?: string;
  attemptNumber: number;
  nextRetryAt?: string;
  durationMs?: number;
}): Promise<WebhookLog> {
  const payload = await getPayload({ config });

  const result = await (
    payload.create as (args: {
      collection: "webhook-logs";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<WebhookLog>
  )({
    collection: "webhook-logs",
    data: {
      organisation: log.organisationId,
      webhook_id: log.webhookId,
      event_type: log.eventType,
      payload: log.payload,
      status: log.status,
      response_code: log.responseCode,
      error_message: log.errorMessage,
      attempt_number: log.attemptNumber,
      next_retry_at: log.nextRetryAt,
      duration_ms: log.durationMs,
    },
    overrideAccess: true,
  });

  return result;
}

export async function updateWebhookLastTriggered(webhookId: string): Promise<void> {
  const payload = await getPayload({ config });

  const webhook = await getWebhook(webhookId);
  if (!webhook) return;

  await (
    payload.update as (args: {
      collection: "webhook-registrations";
      id: string;
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<void>
  )({
    collection: "webhook-registrations",
    id: webhook.id,
    data: { last_triggered_at: new Date().toISOString() },
    overrideAccess: true,
  });
}
