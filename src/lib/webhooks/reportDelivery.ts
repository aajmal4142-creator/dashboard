/**
 * Outbound report delivery webhooks (event: report.generated).
 * Pure helpers are unit-tested; I/O lives in the orchestration functions below.
 */

import { getPayload } from "payload";

import config from "@/payload.config";
import {
  CONFIRMED_APPROVAL_STATE,
  buildMachineExportDocument,
  type MachineExportDatapointInput,
  type MachineExportDocument,
} from "@/lib/reports/machineExport";
import type { ReportSnapshot } from "@/lib/reports/types";
import { generateSignature } from "./webhookValidator";
import {
  getWebhook,
  listWebhooks,
  logWebhookAttempt,
  updateWebhookLastTriggered,
  type WebhookRegistration,
} from "./webhookService";

export const REPORT_GENERATED_EVENT = "report.generated" as const;

/** Initial attempt + this many retries on failure. */
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_INITIAL_DELAY_MS = 1000;
export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;

export type ReportDeliveryFormat = "json";

export type ReportGeneratedPayload = {
  event: typeof REPORT_GENERATED_EVENT;
  report_id: string;
  org_id: string;
  format: ReportDeliveryFormat;
  data: MachineExportDocument;
};

export type ReportDeliveryRetryPolicy = {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
};

export type OutboundAuthConfig = {
  type: "bearer" | "apikey" | "basic";
  value?: string;
  apiKeyHeader?: string;
  username?: string;
  password?: string;
};

export type DeliveryAttemptResult = {
  ok: boolean;
  statusCode?: number;
  errorMessage?: string;
  durationMs: number;
};

export type DeliveryAttemptLog = DeliveryAttemptResult & {
  attemptNumber: number;
  status: "success" | "failed" | "retrying";
  nextRetryAt?: string;
};

export type DeliverWithRetryResult = {
  success: boolean;
  attempts: number;
};

const SENSITIVE_HEADER =
  /^(authorization|x-api-key|api-key|x-auth-token|proxy-authorization|x-clearesg-api-key)$/i;
const SENSITIVE_HEADER_HINT = /token|secret|password|bearer|credential/i;

/** Published (final / locked) reports only — never draft. */
export function isReportStatusDeliverable(status: string | null | undefined): boolean {
  return status === "published";
}

export function buildReportGeneratedPayload(args: {
  reportId: string;
  orgId: string;
  data: MachineExportDocument;
  format?: ReportDeliveryFormat;
}): ReportGeneratedPayload {
  return {
    event: REPORT_GENERATED_EVENT,
    report_id: args.reportId,
    org_id: args.orgId,
    format: args.format ?? "json",
    data: args.data,
  };
}

/**
 * Backoff after a failed attempt.
 * attemptNumber is 1-based (the attempt that just failed).
 * attempt 1 → delayMs, 2 → 2×, 3 → 4× when exponential.
 */
export function computeReportDeliveryBackoffMs(
  attemptNumber: number,
  policy: Pick<ReportDeliveryRetryPolicy, "retryDelayMs" | "exponentialBackoff">,
): number {
  const n = Math.max(1, attemptNumber);
  if (!policy.exponentialBackoff) return policy.retryDelayMs;
  return policy.retryDelayMs * Math.pow(2, n - 1);
}

export function parseRetryPolicy(raw: unknown): ReportDeliveryRetryPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelayMs: DEFAULT_INITIAL_DELAY_MS,
      exponentialBackoff: true,
    };
  }
  const obj = raw as Record<string, unknown>;
  const maxRetries =
    typeof obj.maxRetries === "number" && obj.maxRetries >= 0
      ? Math.floor(obj.maxRetries)
      : DEFAULT_MAX_RETRIES;
  const retryDelayMs =
    typeof obj.retryDelayMs === "number" && obj.retryDelayMs >= 0
      ? Math.floor(obj.retryDelayMs)
      : DEFAULT_INITIAL_DELAY_MS;
  const exponentialBackoff =
    typeof obj.exponentialBackoff === "boolean" ? obj.exponentialBackoff : true;
  return { maxRetries, retryDelayMs, exponentialBackoff };
}

export function maskSecretValue(value: string): string {
  if (!value) return "***";
  const bearer = /^(Bearer)\s+/i.exec(value);
  if (bearer) return `${bearer[1]} ***`;
  const basic = /^(Basic)\s+/i.exec(value);
  if (basic) return `${basic[1]} ***`;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…***`;
}

/** Mask auth tokens in header maps before logging. Never log raw secrets. */
export function maskAuthHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER.test(key) || SENSITIVE_HEADER_HINT.test(key)) {
      out[key] = maskSecretValue(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Strip nested auth/secrets from objects destined for webhook-logs.payload. */
export function sanitizePayloadForLog(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== "object") return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadForLog(item));
  }
  const src = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (SENSITIVE_HEADER.test(key) || SENSITIVE_HEADER_HINT.test(key)) {
      out[key] = typeof value === "string" ? maskSecretValue(value) : "***";
      continue;
    }
    if (
      key === "headers" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const asStrings: Record<string, string> = {};
      for (const [hk, hv] of Object.entries(value as Record<string, unknown>)) {
        asStrings[hk] = typeof hv === "string" ? hv : String(hv);
      }
      out[key] = maskAuthHeaders(asStrings);
      continue;
    }
    if (key === "authentication") {
      out[key] = { redacted: true };
      continue;
    }
    out[key] = sanitizePayloadForLog(value);
  }
  return out;
}

export function parseCustomHeaders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function parseOutboundAuth(raw: unknown): OutboundAuthConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (type !== "bearer" && type !== "apikey" && type !== "basic") return null;
  return {
    type,
    value: typeof obj.value === "string" ? obj.value : undefined,
    apiKeyHeader: typeof obj.apiKeyHeader === "string" ? obj.apiKeyHeader : undefined,
    username: typeof obj.username === "string" ? obj.username : undefined,
    password: typeof obj.password === "string" ? obj.password : undefined,
  };
}

export function buildOutboundHeaders(args: {
  webhookId: string;
  eventType: string;
  secret: string;
  body: string;
  customHeaders?: Record<string, string>;
  authentication?: OutboundAuthConfig | null;
}): Record<string, string> {
  const signature = generateSignature(args.body, args.secret);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ClearESG/1.0",
    "X-Webhook-Signature": signature,
    "X-Webhook-ID": args.webhookId,
    "X-Webhook-Event": args.eventType,
  };

  if (args.customHeaders) {
    Object.assign(headers, args.customHeaders);
  }

  const auth = args.authentication;
  if (auth) {
    if (auth.type === "bearer" && auth.value) {
      headers.Authorization = `Bearer ${auth.value}`;
    } else if (auth.type === "apikey" && auth.value && auth.apiKeyHeader) {
      headers[auth.apiKeyHeader] = auth.value;
    } else if (auth.type === "basic" && auth.username && auth.password) {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    }
  }

  return headers;
}

export function webhookSubscribesToEvent(events: unknown, eventType: string): boolean {
  if (!Array.isArray(events)) return false;
  return events.some((e) => e === eventType);
}

/**
 * Run delivery with retries. Pure control-flow — inject attempt + sleep for tests.
 * maxRetries = number of retries after the first attempt (total attempts = maxRetries + 1).
 */
export async function deliverWithRetry(opts: {
  policy: ReportDeliveryRetryPolicy;
  attempt: (attemptNumber: number) => Promise<DeliveryAttemptResult>;
  sleep?: (ms: number) => Promise<void>;
  onAttempt?: (log: DeliveryAttemptLog) => Promise<void>;
  now?: () => number;
}): Promise<DeliverWithRetryResult> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const maxAttempts = opts.policy.maxRetries + 1;
  let last: DeliveryAttemptResult = {
    ok: false,
    errorMessage: "No attempts",
    durationMs: 0,
  };

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    last = await opts.attempt(attemptNumber);

    if (last.ok) {
      await opts.onAttempt?.({
        ...last,
        attemptNumber,
        status: "success",
      });
      return { success: true, attempts: attemptNumber };
    }

    const hasMore = attemptNumber < maxAttempts;
    if (hasMore) {
      const delayMs = computeReportDeliveryBackoffMs(attemptNumber, opts.policy);
      const nextRetryAt = new Date(now() + delayMs).toISOString();
      await opts.onAttempt?.({
        ...last,
        attemptNumber,
        status: "retrying",
        nextRetryAt,
      });
      await sleep(delayMs);
    } else {
      await opts.onAttempt?.({
        ...last,
        attemptNumber,
        status: "failed",
        errorMessage:
          last.errorMessage != null
            ? `Failed after ${maxAttempts} attempts: ${last.errorMessage}`
            : `Failed after ${maxAttempts} attempts`,
      });
    }
  }

  return { success: false, attempts: maxAttempts };
}

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export async function loadReportExportDocument(args: {
  reportId: string;
  organisationId: string;
}): Promise<{
  report: {
    id: string;
    status: string;
    organisationId: string;
    periodId: string | null;
    snapshot: ReportSnapshot;
  };
  document: MachineExportDocument;
} | null> {
  const payload = await getPayload({ config });

  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: args.reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return null;
  }

  const orgId = relationId(report.organisation);
  if (!orgId || orgId !== args.organisationId) return null;

  const status = typeof report.status === "string" ? report.status : "";
  if (!isReportStatusDeliverable(status)) return null;

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot || typeof snapshot !== "object") return null;

  const periodId = relationId(report.period);
  const confirmed = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: orgId } },
        ...(periodId ? [{ period: { equals: periodId } }] : []),
        { approvalState: { equals: CONFIRMED_APPROVAL_STATE } },
      ],
    },
    limit: 5000,
    overrideAccess: true,
  });

  const datapoints: MachineExportDatapointInput[] = confirmed.docs.map((d) => ({
    id: String(d.id),
    value: d.value,
    unit: d.unit,
    metricKey: d.metricKey,
    quality: d.quality,
    approvalState: d.approvalState,
    enteredAt: d.enteredAt ?? null,
    updatedAt: d.updatedAt,
    createdAt: d.createdAt,
  }));

  const document = buildMachineExportDocument(snapshot, {
    organisationId: orgId,
    periodId,
    status,
    datapoints,
  });

  return {
    report: {
      id: String(report.id),
      status,
      organisationId: orgId,
      periodId,
      snapshot,
    },
    document,
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

export async function deliverReportToWebhook(args: {
  webhook: WebhookRegistration;
  organisationId: string;
  payload: ReportGeneratedPayload;
  sleep?: (ms: number) => Promise<void>;
}): Promise<DeliverWithRetryResult> {
  const policy = parseRetryPolicy(args.webhook.retry_policy);
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
        eventType: REPORT_GENERATED_EVENT,
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
        eventType: REPORT_GENERATED_EVENT,
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

export type ReportDeliverySummary = {
  webhook_id: string;
  success: boolean;
  attempts: number;
};

/**
 * Deliver a published report to all active report.generated webhooks for the org.
 * Refuses draft / unverified reports.
 */
export async function deliverReportWebhooks(args: {
  reportId: string;
  organisationId: string;
  webhookId?: string;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  ok: boolean;
  reason?: string;
  deliveries: ReportDeliverySummary[];
  payload?: ReportGeneratedPayload;
}> {
  const loaded = await loadReportExportDocument({
    reportId: args.reportId,
    organisationId: args.organisationId,
  });

  if (!loaded) {
    return {
      ok: false,
      reason:
        "Report not found, not published, or missing snapshot. Only verified (published) reports can be delivered.",
      deliveries: [],
    };
  }

  const payload = buildReportGeneratedPayload({
    reportId: loaded.report.id,
    orgId: loaded.report.organisationId,
    data: loaded.document,
    format: "json",
  });

  let webhooks = (await listWebhooks(args.organisationId)).filter(
    (w) =>
      w.status === "active" && webhookSubscribesToEvent(w.events, REPORT_GENERATED_EVENT),
  );

  if (args.webhookId) {
    webhooks = webhooks.filter((w) => w.webhook_id === args.webhookId);
    if (webhooks.length === 0) {
      const single = await getWebhook(args.webhookId);
      if (
        !single ||
        single.organisation !== args.organisationId ||
        single.status !== "active" ||
        !webhookSubscribesToEvent(single.events, REPORT_GENERATED_EVENT)
      ) {
        return {
          ok: false,
          reason: "Webhook not found or not subscribed to report.generated",
          deliveries: [],
          payload,
        };
      }
      webhooks = [single];
    }
  }

  if (webhooks.length === 0) {
    return {
      ok: true,
      reason: "No active report.generated webhooks registered",
      deliveries: [],
      payload,
    };
  }

  const deliveries: ReportDeliverySummary[] = [];
  for (const webhook of webhooks) {
    const result = await deliverReportToWebhook({
      webhook,
      organisationId: args.organisationId,
      payload,
      sleep: args.sleep,
    });
    deliveries.push({
      webhook_id: webhook.webhook_id,
      success: result.success,
      attempts: result.attempts,
    });
  }

  const anySuccess = deliveries.some((d) => d.success);
  return {
    ok: anySuccess || deliveries.length === 0,
    deliveries,
    payload,
  };
}

/** Fire-and-forget after publish — never blocks the publish response. */
export function scheduleReportGeneratedWebhooks(args: {
  reportId: string;
  organisationId: string;
}): void {
  void deliverReportWebhooks({
    reportId: args.reportId,
    organisationId: args.organisationId,
  }).catch((err) => {
    console.error(
      `[webhook] report.generated delivery failed for report ${args.reportId}`,
      err,
    );
  });
}

export type ReportDeliveryLogRow = {
  id: string;
  webhook_id: string;
  status: "success" | "failed" | "retrying";
  response_code: number | null;
  error_message: string | null;
  attempt_number: number;
  next_retry_at: string | null;
  duration_ms: number | null;
  createdAt: string;
  report_id: string | null;
};

export async function listReportDeliveries(args: {
  reportId: string;
  organisationId: string;
  limit?: number;
}): Promise<ReportDeliveryLogRow[]> {
  const payload = await getPayload({ config });
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

  const result = await payload.find({
    collection: "webhook-logs",
    where: {
      and: [
        { organisation: { equals: args.organisationId } },
        { event_type: { equals: REPORT_GENERATED_EVENT } },
      ],
    },
    sort: "-createdAt",
    limit: Math.min(limit * 5, 1000),
    overrideAccess: true,
  });

  const rows: ReportDeliveryLogRow[] = [];
  for (const doc of result.docs) {
    const payloadField = doc.payload;
    let reportId: string | null = null;
    if (
      payloadField &&
      typeof payloadField === "object" &&
      !Array.isArray(payloadField) &&
      "report_id" in payloadField
    ) {
      const rid = (payloadField as { report_id?: unknown }).report_id;
      reportId = typeof rid === "string" ? rid : null;
    }
    if (reportId !== args.reportId) continue;

    rows.push({
      id: String(doc.id),
      webhook_id: doc.webhook_id,
      status: doc.status,
      response_code: typeof doc.response_code === "number" ? doc.response_code : null,
      error_message: doc.error_message ?? null,
      attempt_number: doc.attempt_number,
      next_retry_at: doc.next_retry_at ? String(doc.next_retry_at) : null,
      duration_ms: typeof doc.duration_ms === "number" ? doc.duration_ms : null,
      createdAt: doc.createdAt,
      report_id: reportId,
    });

    if (rows.length >= limit) break;
  }

  return rows;
}
