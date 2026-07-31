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
  format: ReportDeliveryFormat;
  status: ScheduleDeliveryStatus;
  nextRunAt: string;
  lastRunAt: string | null;
  lastStatus: "success" | "failed" | "skipped" | null;
  lastError: string | null;
  retryCount: number;
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
  recipients?: Array<{ email: string; id?: string | null }> | null;
  format: ReportDeliveryFormat;
  status: ScheduleDeliveryStatus;
  nextRunAt: string;
  lastRunAt?: string | null;
  lastStatus?: "success" | "failed" | "skipped" | null;
  lastError?: string | null;
  retryCount?: number | null;
}): ScheduledReportRow {
  return {
    id: String(doc.id),
    reportId: relId(doc.report),
    organisationId: relId(doc.organisation),
    frequency: doc.schedule.frequency,
    time: doc.schedule.time,
    timezone: doc.schedule.timezone,
    dayOfWeek: doc.schedule.dayOfWeek ?? null,
    dayOfMonth: doc.schedule.dayOfMonth ?? null,
    recipients: (doc.recipients ?? []).map((r) => r.email),
    format: doc.format,
    status: doc.status,
    nextRunAt: String(doc.nextRunAt),
    lastRunAt: doc.lastRunAt ? String(doc.lastRunAt) : null,
    lastStatus: doc.lastStatus ?? null,
    lastError: doc.lastError ?? null,
    retryCount: doc.retryCount ?? 0,
  };
}

async function getPayloadClient(): Promise<Payload> {
  return getPayload({ config });
}

export async function createReportSchedule(
  input: CreateScheduleInput,
): Promise<ScheduledReportRow> {
  const recipients = normalizeRecipients(input.recipients);
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
      recipients: recipients.map((email) => ({ email })),
      format: input.format,
      status: input.status ?? "active",
      nextRunAt: nextRunAt.toISOString(),
      retryCount: 0,
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
  const recipients = input.recipients
    ? normalizeRecipients(input.recipients)
    : (existing.recipients ?? []).map((r) => r.email);
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
      recipients: recipients.map((email) => ({ email })),
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

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
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

      const recipients = (doc.recipients ?? []).map((r) => r.email);
      if (recipients.length === 0) {
        throw new Error("Schedule has no recipients");
      }

      for (const to of recipients) {
        const result = await sendEmail({
          to,
          orgName: snapshot.organisationName,
          framework: report.framework,
          periodLabel: snapshot.periodLabel,
          reportDate: now,
          liveReportUrl,
          attachment,
        });
        if (result.delivery === "failed") {
          throw new Error(result.error ?? "Email delivery failed");
        }
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
          lastStatus: "success",
          lastError: null,
          retryCount: 0,
          lastDeliveredForRunAt: dueRunAt,
          nextRunAt: nextRunAt.toISOString(),
          claimedAt: null,
          claimedRunAt: null,
        },
        overrideAccess: true,
      });

      sent += 1;
      results.push({ scheduleId, outcome: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scheduled send failed";
      const nextRetry = (doc.retryCount ?? 0) + 1;
      const spec = toSpec(doc.schedule);

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

export { generateReportAttachment } from "./generateReportAttachment";
