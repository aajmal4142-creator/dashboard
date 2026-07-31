import { getPayload, type Where } from "payload";
import { randomUUID } from "crypto";
import config from "@/payload.config";
import { writeAuditLog } from "@/lib/audit/write";
import { generateSecret } from "./webhookValidator";

export type WebhookRetryPolicy = {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
};

export type WebhookAuthentication = {
  type: "bearer" | "apikey" | "basic";
  value?: string;
  apiKeyHeader?: string;
  username?: string;
  password?: string;
};

export type RegisterWebhookOptions = {
  headers?: Record<string, string>;
  authentication?: WebhookAuthentication;
  retry_policy?: WebhookRetryPolicy;
};

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
  retry_policy?: WebhookRetryPolicy | null;
  headers?: Record<string, string> | null;
  authentication?: WebhookAuthentication | null;
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
  options?: RegisterWebhookOptions,
): Promise<WebhookRegistration> {
  const payload = await getPayload({ config });
  const webhookId = randomUUID();
  const secret = generateSecret();

  const data: Record<string, unknown> = {
    organisation: organisationId,
    webhook_id: webhookId,
    endpoint_url: endpoint,
    secret,
    events,
    status: "active",
    retry_count: 0,
  };

  if (options?.headers) data.headers = options.headers;
  if (options?.authentication) data.authentication = options.authentication;
  if (options?.retry_policy) {
    data.retry_policy = options.retry_policy;
  } else if (events.includes("report.generated")) {
    data.retry_policy = {
      maxRetries: 3,
      retryDelayMs: 1000,
      exponentialBackoff: true,
    };
  }

  const webhook = await (
    payload.create as (args: {
      collection: "webhook-registrations";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<WebhookRegistration>
  )({
    collection: "webhook-registrations",
    data,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId,
    actorId,
    action: "webhook.registered",
    entityType: "webhook-registrations",
    entityId: webhookId,
    after: {
      webhook_id: webhookId,
      endpoint_url: endpoint,
      events,
      has_custom_headers: Boolean(options?.headers),
      has_authentication: Boolean(options?.authentication),
    },
  });

  return webhook;
}

function orgIdFromRelation(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}

function normalizeWebhookDoc(doc: WebhookRegistration): WebhookRegistration {
  const events = Array.isArray(doc.events)
    ? doc.events.filter((e): e is string => typeof e === "string")
    : [];
  const headers =
    doc.headers && typeof doc.headers === "object" && !Array.isArray(doc.headers)
      ? (doc.headers as Record<string, string>)
      : null;
  const authentication =
    doc.authentication &&
    typeof doc.authentication === "object" &&
    !Array.isArray(doc.authentication)
      ? (doc.authentication as WebhookAuthentication)
      : null;
  const retry_policy =
    doc.retry_policy &&
    typeof doc.retry_policy === "object" &&
    !Array.isArray(doc.retry_policy)
      ? (doc.retry_policy as WebhookRetryPolicy)
      : null;

  return {
    ...doc,
    organisation: orgIdFromRelation(doc.organisation),
    events,
    headers,
    authentication,
    retry_policy,
  };
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

  return result.docs.map(normalizeWebhookDoc);
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

  const doc = result.docs[0];
  return doc ? normalizeWebhookDoc(doc) : null;
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
  source?: "webhook" | "api";
  batchId?: string;
  recordCount?: number;
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
      source: log.source ?? (log.eventType === "data.ingest" ? "api" : "webhook"),
      batch_id: log.batchId,
      record_count: log.recordCount,
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

export type WebhookDeliveryListStatus = "success" | "failed" | "retrying";

export type WebhookDeliveryListRow = {
  id: string;
  webhook_id: string;
  event_type: string;
  status: WebhookDeliveryListStatus;
  response_code: number | null;
  error_message: string | null;
  attempt_number: number;
  next_retry_at: string | null;
  duration_ms: number | null;
  payload: unknown;
  createdAt: string;
  is_dead_letter: boolean;
};

/**
 * List outbound delivery attempts for an organisation (includes dead-letter / failed).
 */
export async function listWebhookDeliveries(args: {
  organisationId: string;
  status?: WebhookDeliveryListStatus;
  webhookId?: string;
  deadLetterOnly?: boolean;
  limit?: number;
}): Promise<WebhookDeliveryListRow[]> {
  const payload = await getPayload({ config });
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

  const and: Where[] = [
    { organisation: { equals: args.organisationId } },
    { source: { not_equals: "api" } },
  ];

  if (args.deadLetterOnly || args.status === "failed") {
    and.push({ status: { equals: "failed" } });
  } else if (args.status) {
    and.push({ status: { equals: args.status } });
  }

  if (args.webhookId) {
    and.push({ webhook_id: { equals: args.webhookId } });
  }

  const result = await payload.find({
    collection: "webhook-logs",
    where: { and },
    sort: "-createdAt",
    limit,
    overrideAccess: true,
  });

  return result.docs.map((doc) => {
    const status = doc.status as WebhookDeliveryListStatus;
    return {
      id: String(doc.id),
      webhook_id: doc.webhook_id,
      event_type: doc.event_type,
      status,
      response_code: typeof doc.response_code === "number" ? doc.response_code : null,
      error_message: doc.error_message ?? null,
      attempt_number: doc.attempt_number,
      next_retry_at: doc.next_retry_at ? String(doc.next_retry_at) : null,
      duration_ms: typeof doc.duration_ms === "number" ? doc.duration_ms : null,
      payload: doc.payload ?? null,
      createdAt: doc.createdAt,
      is_dead_letter: status === "failed",
    };
  });
}
