/**
 * Report schedule CRUD + due-run executor.
 * Pure schedule math lives in scheduleMath.ts; this module owns Payload I/O.
 */

import { getPayload, type Payload } from "payload";

import {
  generateReportAttachment,
  type ReportDeliveryFormat,
} from "@/lib/reports/generateReportAttachment";
import {
  activeRecipientEmails,
  appendDeliveryHistory,
  buildDeliveryEntries,
  mapDeliveryHistoryRows,
  markRecipientUnsubscribed,
  normalizeScheduleRecipients,
  summarizeDeliveryRun,
  type DeliveryHistoryEntry,
  type DeliveryRecipientStatus,
  type ScheduleRecipient,
} from "@/lib/reports/deliveryHistory";
import {
  computeNextRunAt,
  computeRetryAt,
  isClaimActive,
  MAX_SCHEDULE_RETRIES,
  normalizeRecipients,
  shouldSkipDuplicateDelivery,
  validateScheduleSpec,
  type ScheduleFrequency,
  type ScheduleSpec,
} from "@/lib/reports/scheduleMath";
import { sendScheduledReportEmail } from "@/lib/reports/scheduledReportEmail";
import type { ReportSnapshot } from "@/lib/reports/types";
import {
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  unsubscribeSigningSecret,
  verifyUnsubscribeToken,
} from "@/lib/reports/unsubscribeToken";
import { SCHEDULED_REPORTS_SLUG } from "@/collections/ScheduledReports";
import config from "@/payload.config";

export type { ReportDeliveryFormat };
export type ScheduleDeliveryStatus = "active" | "paused" | "completed";

export type CreateScheduleInput = {
  organisationId: string;
  reportId: string;
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
  recipients: string[];
  format: ReportDeliveryFormat;
  dayOfWeek?: number;
  dayOfMonth?: number;
  status?: ScheduleDeliveryStatus;
};

export type UpdateScheduleInput = {
  scheduleId: string;
  organisationId: string;
  reportId: string;
  frequency?: ScheduleFrequency;
  time?: string;
  timezone?: string;
  recipients?: string[];
  format?: ReportDeliveryFormat;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  status?: ScheduleDeliveryStatus;
};

export type ScheduledReportRow = {
  id: string;
  reportId: string;
  organisationId: string;
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  recipients: string[];
  recipientDetails: ScheduleRecipient[];
  format: ReportDeliveryFormat;
  status: ScheduleDeliveryStatus;
  nextRunAt: string;
  lastRunAt: string | null;
  lastStatus: "success" | "failed" | "skipped" | null;
  lastError: string | null;
  retryCount: number;
  deliveryHistory: DeliveryHistoryEntry[];
};

export type ExecuteDueResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{
    scheduleId: string;
    outcome: "sent" | "failed" | "skipped";
    error?: string;
  }>;
};

type EmailSender = typeof sendScheduledReportEmail;

function relId(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

function asSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as ReportSnapshot;
}

function toSpec(input: {
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}): ScheduleSpec {
  return {
    frequency: input.frequency,
    time: input.time,
    timezone: input.timezone,
    dayOfWeek: input.dayOfWeek ?? undefined,
    dayOfMonth: input.dayOfMonth ?? undefined,
  };
}

function recipientsToPayload(rows: ScheduleRecipient[]) {
  return rows.map((r) => ({
    email: r.email,
    unsubscribed: r.unsubscribed,
    unsubscribedAt: r.unsubscribedAt ?? undefined,
  }));
}

function mergeRecipientList(
  existing: ScheduleRecipient[],
  emails: string[],
): ScheduleRecipient[] {
  const prior = new Map(existing.map((r) => [r.email, r]));
  const normalized = normalizeRecipients(emails);
  return normalized.map((email) => {
    const prev = prior.get(email);
    return (
      prev ?? {
        email,
        unsubscribed: false,
        unsubscribedAt: null,
      }
    );
  });
}

function mapDoc(doc: {
  id: string | number;
  organisation: unknown;
  report: unknown;
  schedule: {
    frequency: ScheduleFrequency;
    time: string;
    timezone: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
  };
  recipients?: Array<{
    email: string;
    unsubscribed?: boolean | null;
    unsubscribedAt?: string | null;
    id?: string | null;
  }> | null;
  format: ReportDeliveryFormat;
  status: ScheduleDeliveryStatus;
  nextRunAt: string;
  lastRunAt?: string | null;
  lastStatus?: "success" | "failed" | "skipped" | null;
  lastError?: string | null;
  retryCount?: number | null;
  deliveryHistory?: unknown;
}): ScheduledReportRow {
  const recipientDetails = normalizeScheduleRecipients(doc.recipients ?? []);
  return {
    id: String(doc.id),
    reportId: relId(doc.report),
    organisationId: relId(doc.organisation),
    frequency: doc.schedule.frequency,
    time: doc.schedule.time,
    timezone: doc.schedule.timezone,
    dayOfWeek: doc.schedule.dayOfWeek ?? null,
    dayOfMonth: doc.schedule.dayOfMonth ?? null,
    recipients: recipientDetails.map((r) => r.email),
    recipientDetails,
    format: doc.format,
    status: doc.status,
    nextRunAt: String(doc.nextRunAt),
    lastRunAt: doc.lastRunAt ? String(doc.lastRunAt) : null,
    lastStatus: doc.lastStatus ?? null,
    lastError: doc.lastError ?? null,
    retryCount: doc.retryCount ?? 0,
    deliveryHistory: mapDeliveryHistoryRows(doc.deliveryHistory),
  };
}

async function getPayloadClient(): Promise<Payload> {
  return getPayload({ config });
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function unsubscribeUrlFor(scheduleId: string, email: string): string | null {
  const secret = unsubscribeSigningSecret();
  if (!secret) return null;
  try {
    const token = createUnsubscribeToken({ scheduleId, email }, secret);
    return buildUnsubscribeUrl({ baseUrl: appBaseUrl(), token });
  } catch {
    return null;
  }
}

export async function createReportSchedule(
  input: CreateScheduleInput,
): Promise<ScheduledReportRow> {
  const emails = normalizeRecipients(input.recipients);
  const recipientDetails = emails.map((email) => ({
    email,
    unsubscribed: false,
    unsubscribedAt: null as string | null,
  }));
  const spec = toSpec(input);
  validateScheduleSpec(spec);
  const nextRunAt = computeNextRunAt(spec);

  const payload = await getPayloadClient();
  const created = await payload.create({
    collection: SCHEDULED_REPORTS_SLUG,
    data: {
      organisation: input.organisationId,
      report: input.reportId,
      schedule: {
        frequency: input.frequency,
        time: input.time,
        timezone: input.timezone,
        dayOfWeek: input.dayOfWeek ?? undefined,
        dayOfMonth: input.dayOfMonth ?? undefined,
      },
      recipients: recipientsToPayload(recipientDetails),
      format: input.format,
      status: input.status ?? "active",
      nextRunAt: nextRunAt.toISOString(),
      retryCount: 0,
      deliveryHistory: [],
    },
    overrideAccess: true,
  });

  return mapDoc(created);
}

export async function updateReportSchedule(
  input: UpdateScheduleInput,
): Promise<ScheduledReportRow> {
  const payload = await getPayloadClient();
  let existing;
  try {
    existing = await payload.findByID({
      collection: SCHEDULED_REPORTS_SLUG,
      id: input.scheduleId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    throw new Error("Schedule not found");
  }

  if (relId(existing.organisation) !== input.organisationId) {
    throw new Error("Schedule not found");
  }
  if (relId(existing.report) !== input.reportId) {
    throw new Error("Schedule not found");
  }

  const frequency = input.frequency ?? existing.schedule.frequency;
  const time = input.time ?? existing.schedule.time;
  const timezone = input.timezone ?? existing.schedule.timezone;
  const dayOfWeek =
    input.dayOfWeek === null
      ? undefined
      : (input.dayOfWeek ?? existing.schedule.dayOfWeek ?? undefined);
  const dayOfMonth =
    input.dayOfMonth === null
      ? undefined
      : (input.dayOfMonth ?? existing.schedule.dayOfMonth ?? undefined);
  const existingRecipients = normalizeScheduleRecipients(existing.recipients ?? []);
  const recipientDetails = input.recipients
    ? mergeRecipientList(existingRecipients, input.recipients)
    : existingRecipients;
  const format = input.format ?? existing.format;
  const status = input.status ?? existing.status;

  const scheduleChanged =
    input.frequency !== undefined ||
    input.time !== undefined ||
    input.timezone !== undefined ||
    input.dayOfWeek !== undefined ||
    input.dayOfMonth !== undefined;

  const spec = toSpec({ frequency, time, timezone, dayOfWeek, dayOfMonth });
  validateScheduleSpec(spec);

  const nextRunAt = scheduleChanged
    ? computeNextRunAt(spec)
    : new Date(String(existing.nextRunAt));

  const updated = await payload.update({
    collection: SCHEDULED_REPORTS_SLUG,
    id: input.scheduleId,
    data: {
      schedule: {
        frequency,
        time,
        timezone,
        dayOfWeek,
        dayOfMonth,
      },
      recipients: recipientsToPayload(recipientDetails),
      format,
      status,
      nextRunAt: nextRunAt.toISOString(),
      ...(status === "paused" || status === "completed"
        ? { claimedAt: null, claimedRunAt: null }
        : {}),
      ...(scheduleChanged ? { retryCount: 0 } : {}),
    },
    overrideAccess: true,
  });

  return mapDoc(updated);
}

export async function listReportSchedules(
  organisationId: string,
  reportId: string,
): Promise<ScheduledReportRow[]> {
  const payload = await getPayloadClient();
  const found = await payload.find({
    collection: SCHEDULED_REPORTS_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { report: { equals: reportId } },
      ],
    },
    sort: "nextRunAt",
    limit: 100,
    overrideAccess: true,
  });
  return found.docs.map(mapDoc);
}

export async function deleteReportSchedule(
  organisationId: string,
  reportId: string,
  scheduleId: string,
): Promise<void> {
  const payload = await getPayloadClient();
  let existing;
  try {
    existing = await payload.findByID({
      collection: SCHEDULED_REPORTS_SLUG,
      id: scheduleId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    throw new Error("Schedule not found");
  }
  if (relId(existing.organisation) !== organisationId) {
    throw new Error("Schedule not found");
  }
  if (relId(existing.report) !== reportId) {
    throw new Error("Schedule not found");
  }
  await payload.delete({
    collection: SCHEDULED_REPORTS_SLUG,
    id: scheduleId,
    overrideAccess: true,
  });
}

/** @deprecated Prefer deleteReportSchedule with org/report scope. */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const payload = await getPayloadClient();
  await payload.delete({
    collection: SCHEDULED_REPORTS_SLUG,
    id: scheduleId,
    overrideAccess: true,
  });
}

/**
 * Opt a recipient out of a schedule via signed unsubscribe token.
 */
export async function unsubscribeFromScheduleToken(
  token: string,
): Promise<{ email: string; scheduleId: string }> {
  const secret = unsubscribeSigningSecret();
  if (!secret) {
    throw new Error("Unsubscribe is not configured");
  }
  const payloadData = verifyUnsubscribeToken(token, secret);
  if (!payloadData) {
    throw new Error("Invalid or expired unsubscribe link");
  }

  const payload = await getPayloadClient();
  let existing;
  try {
    existing = await payload.findByID({
      collection: SCHEDULED_REPORTS_SLUG,
      id: payloadData.scheduleId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    throw new Error("Schedule not found");
  }

  const recipients = markRecipientUnsubscribed(
    normalizeScheduleRecipients(existing.recipients ?? []),
    payloadData.email,
  );

  await payload.update({
    collection: SCHEDULED_REPORTS_SLUG,
    id: payloadData.scheduleId,
    data: {
      recipients: recipientsToPayload(recipients),
    },
    overrideAccess: true,
  });

  return {
    email: payloadData.email,
    scheduleId: payloadData.scheduleId,
  };
}

/**
 * Process due active schedules. Idempotent: skips already-delivered slots and active claims.
 */
export async function executeDueScheduledReports(options?: {
  now?: Date;
  limit?: number;
  sendEmail?: EmailSender;
}): Promise<ExecuteDueResult> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 25;
  const sendEmail = options?.sendEmail ?? sendScheduledReportEmail;
  const payload = await getPayloadClient();

  const due = await payload.find({
    collection: SCHEDULED_REPORTS_SLUG,
    where: {
      and: [
        { status: { equals: "active" } },
        { nextRunAt: { less_than_equal: now.toISOString() } },
      ],
    },
    sort: "nextRunAt",
    limit,
    overrideAccess: true,
  });

  const results: ExecuteDueResult["results"] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const doc of due.docs) {
    const scheduleId = String(doc.id);
    const dueRunAt = String(doc.nextRunAt);

    if (
      shouldSkipDuplicateDelivery(
        doc.lastDeliveredForRunAt ? String(doc.lastDeliveredForRunAt) : null,
        dueRunAt,
      )
    ) {
      const spec = toSpec(doc.schedule);
      const next = computeNextRunAt(spec, new Date(new Date(dueRunAt).getTime() + 1000));
      await payload.update({
        collection: SCHEDULED_REPORTS_SLUG,
        id: scheduleId,
        data: {
          nextRunAt: next.toISOString(),
          lastStatus: "skipped",
          claimedAt: null,
          claimedRunAt: null,
          retryCount: 0,
        },
        overrideAccess: true,
      });
      skipped += 1;
      results.push({ scheduleId, outcome: "skipped", error: "already delivered" });
      continue;
    }

    if (
      isClaimActive(doc.claimedAt ? String(doc.claimedAt) : null, now) &&
      doc.claimedRunAt &&
      String(doc.claimedRunAt) === dueRunAt
    ) {
      skipped += 1;
      results.push({ scheduleId, outcome: "skipped", error: "claim held" });
      continue;
    }

    await payload.update({
      collection: SCHEDULED_REPORTS_SLUG,
      id: scheduleId,
      data: {
        claimedAt: now.toISOString(),
        claimedRunAt: dueRunAt,
      },
      overrideAccess: true,
    });

    const perRecipient: Array<{
      email: string;
      status: DeliveryRecipientStatus;
      error?: string | null;
      trackingId?: string | null;
      providerMessageId?: string | null;
    }> = [];

    try {
      const report = await payload.findByID({
        collection: "reports",
        id: relId(doc.report),
        depth: 0,
        overrideAccess: true,
      });
      const snapshot = asSnapshot(report.snapshot);
      if (!snapshot) {
        throw new Error("Report has no snapshot to deliver");
      }

      const attachment = await generateReportAttachment({
        snapshot,
        format: doc.format,
      });

      const liveReportUrl = report.shareToken
        ? `${appBaseUrl()}/r/${report.shareToken}`
        : null;

      const recipientDetails = normalizeScheduleRecipients(doc.recipients ?? []);
      const activeEmails = activeRecipientEmails(recipientDetails);
      const unsubscribedEmails = recipientDetails
        .filter((r) => r.unsubscribed)
        .map((r) => r.email);

      for (const email of unsubscribedEmails) {
        perRecipient.push({
          email,
          status: "skipped",
          error: "unsubscribed",
        });
      }

      if (activeEmails.length === 0) {
        const historyEntries = buildDeliveryEntries({
          runAt: dueRunAt,
          sentAt: now.toISOString(),
          results: perRecipient,
        });
        const deliveryHistory = appendDeliveryHistory(
          mapDeliveryHistoryRows(doc.deliveryHistory),
          historyEntries,
        );
        const spec = toSpec(doc.schedule);
        const nextRunAt = computeNextRunAt(
          spec,
          new Date(new Date(dueRunAt).getTime() + 1000),
        );
        await payload.update({
          collection: SCHEDULED_REPORTS_SLUG,
          id: scheduleId,
          data: {
            lastRunAt: now.toISOString(),
            lastStatus: "skipped",
            lastError: "All recipients unsubscribed",
            retryCount: 0,
            lastDeliveredForRunAt: dueRunAt,
            nextRunAt: nextRunAt.toISOString(),
            claimedAt: null,
            claimedRunAt: null,
            deliveryHistory,
          },
          overrideAccess: true,
        });
        skipped += 1;
        results.push({
          scheduleId,
          outcome: "skipped",
          error: "all recipients unsubscribed",
        });
        continue;
      }

      for (const to of activeEmails) {
        const trackingId = crypto.randomUUID();
        const openTrackingUrl = `${appBaseUrl()}/api/r/open/${trackingId}`;
        const result = await sendEmail({
          to,
          orgName: snapshot.organisationName,
          framework: report.framework,
          periodLabel: snapshot.periodLabel,
          reportDate: now,
          liveReportUrl,
          unsubscribeUrl: unsubscribeUrlFor(scheduleId, to),
          openTrackingUrl,
          attachment,
        });
        if (result.delivery === "failed") {
          perRecipient.push({
            email: to,
            status: "failed",
            error: result.error ?? "Email delivery failed",
            trackingId,
            providerMessageId: result.id ?? null,
          });
        } else {
          perRecipient.push({
            email: to,
            status: "sent",
            trackingId,
            providerMessageId: result.id ?? null,
          });
        }
      }

      const historyEntries = buildDeliveryEntries({
        runAt: dueRunAt,
        sentAt: now.toISOString(),
        results: perRecipient,
      });
      const deliveryHistory = appendDeliveryHistory(
        mapDeliveryHistoryRows(doc.deliveryHistory),
        historyEntries,
      );
      const runSummary = summarizeDeliveryRun(perRecipient);

      if (runSummary === "failed") {
        const failedRow = perRecipient.find((r) => r.status === "failed");
        throw new Error(failedRow?.error ?? "Email delivery failed");
      }

      const spec = toSpec(doc.schedule);
      const nextRunAt = computeNextRunAt(
        spec,
        new Date(new Date(dueRunAt).getTime() + 1000),
      );

      await payload.update({
        collection: SCHEDULED_REPORTS_SLUG,
        id: scheduleId,
        data: {
          lastRunAt: now.toISOString(),
          lastStatus: runSummary,
          lastError: null,
          retryCount: 0,
          lastDeliveredForRunAt: dueRunAt,
          nextRunAt: nextRunAt.toISOString(),
          claimedAt: null,
          claimedRunAt: null,
          deliveryHistory,
        },
        overrideAccess: true,
      });

      sent += 1;
      results.push({ scheduleId, outcome: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scheduled send failed";
      const nextRetry = (doc.retryCount ?? 0) + 1;
      const spec = toSpec(doc.schedule);

      const deliveryHistory = appendDeliveryHistory(
        mapDeliveryHistoryRows(doc.deliveryHistory),
        buildDeliveryEntries({
          runAt: dueRunAt,
          sentAt: now.toISOString(),
          results:
            perRecipient.length > 0
              ? perRecipient
              : [{ email: "_schedule", status: "failed", error: message }],
        }),
      );

      if (nextRetry >= MAX_SCHEDULE_RETRIES) {
        const nextRunAt = computeNextRunAt(
          spec,
          new Date(new Date(dueRunAt).getTime() + 1000),
        );
        await payload.update({
          collection: SCHEDULED_REPORTS_SLUG,
          id: scheduleId,
          data: {
            lastRunAt: now.toISOString(),
            lastStatus: "failed",
            lastError: message.slice(0, 500),
            retryCount: MAX_SCHEDULE_RETRIES,
            nextRunAt: nextRunAt.toISOString(),
            claimedAt: null,
            claimedRunAt: null,
            deliveryHistory,
          },
          overrideAccess: true,
        });
      } else {
        await payload.update({
          collection: SCHEDULED_REPORTS_SLUG,
          id: scheduleId,
          data: {
            lastRunAt: now.toISOString(),
            lastStatus: "failed",
            lastError: message.slice(0, 500),
            retryCount: nextRetry,
            nextRunAt: computeRetryAt(nextRetry, now).toISOString(),
            claimedAt: null,
            claimedRunAt: null,
            deliveryHistory,
          },
          overrideAccess: true,
        });
      }

      failed += 1;
      results.push({ scheduleId, outcome: "failed", error: message });
    }
  }

  return {
    attempted: due.docs.length,
    sent,
    failed,
    skipped,
    results,
  };
}

/** Legacy export kept for callers expecting frequency-only next run. */
export function getNextExecutionTime(frequency: ScheduleFrequency, lastRun?: Date): Date {
  return computeNextRunAt(
    {
      frequency,
      time: "08:00",
      timezone: "UTC",
      dayOfWeek: 1,
      dayOfMonth: 1,
    },
    lastRun ?? new Date(),
  );
}

export {
  computeNextRunAt,
  computeRetryAt,
  computeRetryDelayMs,
  MAX_SCHEDULE_RETRIES,
  normalizeRecipients,
  shouldSkipDuplicateDelivery,
  type ScheduleFrequency,
  type ScheduleSpec,
} from "./scheduleMath";

export {
  activeRecipientEmails,
  appendDeliveryHistory,
  summarizeDeliveryRun,
  type DeliveryHistoryEntry,
  type ScheduleRecipient,
} from "./deliveryHistory";

export { generateReportAttachment } from "./generateReportAttachment";
