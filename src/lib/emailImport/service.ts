import { getPayload } from "payload";
import { randomBytes } from "node:crypto";

import config from "@/payload.config";
import type { Quality } from "@/lib/calc";
import { writeDatapoint, type ExistingDatapoint } from "@/lib/data";
import { sendTransactionalEmail } from "@/lib/email/send";
import { ensureOpenPeriod } from "@/lib/org/period";
import { writeAuditLog } from "@/lib/audit/write";
import { BillingDeniedError } from "@/lib/billing";

import { extractEmailAddress, isSenderWhitelisted } from "./whitelist";
import {
  extractInboundToken,
  normalizeInboundMessage,
  pickCsvAttachment,
  type NormalizedInboundMessage,
} from "./parseInbound";
import { validateInboundCsv } from "./processCsv";
import { buildImportReply } from "./replies";

export type ProcessInboundInput = {
  raw: unknown;
  formIdOverride?: string;
  dryRun?: boolean;
  skipReply?: boolean;
};

export type ProcessInboundResult = {
  status: number;
  body: {
    ok: boolean;
    status: "success" | "partial" | "rejected" | "failed";
    reason?: string;
    formId?: string;
    written?: number;
    rejected?: number;
    unchanged?: number;
    dryRun?: boolean;
    replyDelivery?: string;
    logId?: string;
  };
};

type EmailImportLogData = {
  organisation: string;
  form?: string;
  fromEmail: string;
  subject?: string;
  status: "success" | "partial" | "rejected" | "failed";
  reason?: string;
  attachmentName?: string;
  recordsParsed?: number;
  recordsWritten?: number;
  recordsRejected?: number;
  recordsUnchanged?: number;
  replyDelivery?: "resend" | "console" | "failed" | "skipped";
  details?: Record<string, unknown>;
  providerMessageId?: string;
  durationMs?: number;
};

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

async function loadExisting(
  organisationId: string,
  periodId: string,
): Promise<{ existing: ExistingDatapoint[]; periodLocked: boolean }> {
  const payload = await getPayload({ config });
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { equals: periodId } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });
  return {
    periodLocked: period.status !== "open",
    existing: dps.docs.map((d) => ({
      metricKey: d.metricKey,
      value: typeof d.value === "number" ? d.value : null,
      unit: d.unit ?? null,
      quality: d.quality as Quality,
      approvalState: d.approvalState,
    })),
  };
}

async function findForm(opts: { formId?: string; inboundToken?: string | null }) {
  const payload = await getPayload({ config });

  if (opts.formId) {
    try {
      return await payload.findByID({
        collection: "email-data-collection-forms",
        id: opts.formId,
        depth: 0,
        overrideAccess: true,
      });
    } catch {
      return null;
    }
  }

  if (opts.inboundToken) {
    const found = await payload.find({
      collection: "email-data-collection-forms",
      where: { inboundToken: { equals: opts.inboundToken } },
      limit: 1,
      overrideAccess: true,
    });
    return found.docs[0] ?? null;
  }

  return null;
}

async function writeLog(data: EmailImportLogData): Promise<string | undefined> {
  const payload = await getPayload({ config });
  try {
    const log = await (
      payload.create as (args: {
        collection: "email-import-logs";
        data: EmailImportLogData;
        overrideAccess: true;
      }) => Promise<{ id: string }>
    )({
      collection: "email-import-logs",
      data,
      overrideAccess: true,
    });
    return log.id;
  } catch (err) {
    console.error(
      "email-import log write failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return undefined;
  }
}

async function sendReply(opts: {
  to: string;
  formName: string;
  kind: "success" | "partial" | "error";
  summary: string;
  details?: string[];
}): Promise<"resend" | "console" | "failed"> {
  const reply = buildImportReply({
    formName: opts.formName,
    kind: opts.kind,
    summary: opts.summary,
    details: opts.details,
  });
  const sent = await sendTransactionalEmail({
    to: opts.to,
    subject: reply.subject,
    html: reply.html,
    text: reply.text,
  });
  return sent.delivery;
}

/**
 * Full inbound pipeline: normalize → whitelist → CSV validate → write → reply → audit.
 */
export async function processInboundEmailImport(
  input: ProcessInboundInput,
): Promise<ProcessInboundResult> {
  const started = Date.now();
  const normalized = normalizeInboundMessage(input.raw);
  if (!normalized.ok) {
    return {
      status: 400,
      body: { ok: false, status: "failed", reason: normalized.error },
    };
  }

  const message: NormalizedInboundMessage = normalized.message;
  const fromEmail = extractEmailAddress(message.from);
  const token =
    extractInboundToken({
      to: message.to,
      subject: message.subject,
      inboundToken: message.inboundToken,
    }) ?? null;

  const form = await findForm({
    formId: input.formIdOverride ?? message.formId,
    inboundToken: token,
  });

  if (!form) {
    return {
      status: 404,
      body: {
        ok: false,
        status: "rejected",
        reason: "No matching email collection form. Check inbound token or formId.",
      },
    };
  }

  const organisationId = orgIdOf(form.organisation);
  if (!organisationId) {
    return {
      status: 500,
      body: { ok: false, status: "failed", reason: "Form has no organisation" },
    };
  }

  if (form.status !== "active") {
    const logId = await writeLog({
      organisation: organisationId,
      form: form.id,
      fromEmail,
      subject: message.subject,
      status: "rejected",
      reason: `Form status is "${form.status ?? "unknown"}" (must be active)`,
      providerMessageId: message.providerMessageId,
      durationMs: Date.now() - started,
    });
    return {
      status: 409,
      body: {
        ok: false,
        status: "rejected",
        reason: "Email collection form is not active",
        formId: form.id,
        logId,
      },
    };
  }

  const formRecord = form as typeof form & {
    inboundEnabled?: boolean | null;
    whitelistedSenders?: Array<{ email: string } | null> | null;
    recurringEnabled?: boolean | null;
    lastImportAt?: string | null;
  };

  if (!formRecord.inboundEnabled) {
    const logId = await writeLog({
      organisation: organisationId,
      form: form.id,
      fromEmail,
      subject: message.subject,
      status: "rejected",
      reason: "Inbound email import is disabled for this form",
      providerMessageId: message.providerMessageId,
      durationMs: Date.now() - started,
    });
    return {
      status: 403,
      body: {
        ok: false,
        status: "rejected",
        reason: "Inbound email import is disabled for this form",
        formId: form.id,
        logId,
      },
    };
  }

  const whitelist = formRecord.whitelistedSenders ?? [];
  if (!isSenderWhitelisted(message.from, whitelist)) {
    const logId = await writeLog({
      organisation: organisationId,
      form: form.id,
      fromEmail,
      subject: message.subject,
      status: "rejected",
      reason: "Sender is not on the whitelist",
      providerMessageId: message.providerMessageId,
      durationMs: Date.now() - started,
    });

    let replyDelivery: "resend" | "console" | "failed" | "skipped" = "skipped";
    if (!input.skipReply && !input.dryRun) {
      replyDelivery = await sendReply({
        to: fromEmail,
        formName: form.formName,
        kind: "error",
        summary:
          "Your address is not authorised to submit data for this form. Contact the organisation administrator.",
      });
    }

    return {
      status: 403,
      body: {
        ok: false,
        status: "rejected",
        reason: "Sender is not on the whitelist",
        formId: form.id,
        logId,
        replyDelivery,
      },
    };
  }

  const csvPick = pickCsvAttachment(message.attachments);
  if ("error" in csvPick) {
    const logId = await writeLog({
      organisation: organisationId,
      form: form.id,
      fromEmail,
      subject: message.subject,
      status: "rejected",
      reason: csvPick.error,
      providerMessageId: message.providerMessageId,
      durationMs: Date.now() - started,
    });

    let replyDelivery: "resend" | "console" | "failed" | "skipped" = "skipped";
    if (!input.skipReply && !input.dryRun) {
      replyDelivery = await sendReply({
        to: fromEmail,
        formName: form.formName,
        kind: "error",
        summary: csvPick.error,
      });
    }

    return {
      status: 400,
      body: {
        ok: false,
        status: "rejected",
        reason: csvPick.error,
        formId: form.id,
        logId,
        replyDelivery,
      },
    };
  }

  let periodId: string;
  try {
    const payload = await getPayload({ config });
    const org = await payload.findByID({
      collection: "organisations",
      id: organisationId,
      depth: 0,
      overrideAccess: true,
    });
    periodId = await ensureOpenPeriod(organisationId, org.plan, org.subscriptionStatus);
  } catch (err) {
    const reason =
      err instanceof BillingDeniedError
        ? "Billing limits prevent opening a reporting period"
        : err instanceof Error
          ? err.message
          : "Could not resolve reporting period";
    const logId = await writeLog({
      organisation: organisationId,
      form: form.id,
      fromEmail,
      subject: message.subject,
      status: "failed",
      reason,
      attachmentName: csvPick.filename,
      providerMessageId: message.providerMessageId,
      durationMs: Date.now() - started,
    });
    return {
      status: err instanceof BillingDeniedError ? 402 : 500,
      body: { ok: false, status: "failed", reason, formId: form.id, logId },
    };
  }

  const { existing, periodLocked } = await loadExisting(organisationId, periodId);
  const validated = validateInboundCsv({
    csvText: csvPick.csvText,
    existing,
    periodLocked,
  });

  if (!validated.ok) {
    const rejectDetails =
      validated.diff?.rows
        .filter((r) => r.kind === "rejected")
        .slice(0, 10)
        .map((r) => `${r.metricKey}: ${r.reason ?? "rejected"}`) ?? [];

    const logId = await writeLog({
      organisation: organisationId,
      form: form.id,
      fromEmail,
      subject: message.subject,
      status: "rejected",
      reason: validated.error,
      attachmentName: csvPick.filename,
      recordsParsed: validated.rows.length,
      recordsRejected: validated.diff?.rejected ?? validated.rows.length,
      details: { rejected: rejectDetails },
      providerMessageId: message.providerMessageId,
      durationMs: Date.now() - started,
    });

    let replyDelivery: "resend" | "console" | "failed" | "skipped" = "skipped";
    if (!input.skipReply && !input.dryRun) {
      replyDelivery = await sendReply({
        to: fromEmail,
        formName: form.formName,
        kind: "error",
        summary: validated.error,
        details: rejectDetails,
      });
    }

    return {
      status: 400,
      body: {
        ok: false,
        status: "rejected",
        reason: validated.error,
        formId: form.id,
        rejected: validated.diff?.rejected,
        logId,
        replyDelivery,
        dryRun: input.dryRun,
      },
    };
  }

  const diff = validated.diff;
  const writable = diff.rows.filter(
    (r) => (r.kind === "added" || r.kind === "changed") && r.after,
  );

  if (input.dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        status: diff.rejected > 0 ? "partial" : "success",
        formId: form.id,
        written: 0,
        rejected: diff.rejected,
        unchanged: diff.unchanged,
        dryRun: true,
      },
    };
  }

  const payload = await getPayload({ config });
  const createdBy = orgIdOf(form.createdBy);
  const actorId = createdBy ?? `email-import:${form.id}`;

  let written = 0;
  for (const row of writable) {
    if (!row.after) continue;
    await writeDatapoint(payload, {
      organisationId,
      periodId,
      metricKey: row.metricKey,
      value: row.after.value,
      unit: row.after.unit,
      quality: row.after.quality,
      source: "import",
      actorId,
    });
    written += 1;
  }

  const status: "success" | "partial" =
    diff.rejected > 0 && written > 0
      ? "partial"
      : written > 0 || (diff.unchanged > 0 && diff.rejected === 0)
        ? "success"
        : "partial";

  const rejectDetails = diff.rows
    .filter((r) => r.kind === "rejected")
    .slice(0, 10)
    .map((r) => `${r.metricKey}: ${r.reason ?? "rejected"}`);

  let replyDelivery: "resend" | "console" | "failed" | "skipped" = "skipped";
  if (!input.skipReply) {
    replyDelivery = await sendReply({
      to: fromEmail,
      formName: form.formName,
      kind: status === "success" ? "success" : status === "partial" ? "partial" : "error",
      summary: `Wrote ${written} datapoint(s). Rejected ${diff.rejected}. Unchanged ${diff.unchanged}.`,
      details: rejectDetails.length > 0 ? rejectDetails : undefined,
    });
  }

  const prevResponses = form.responses ?? [];
  const responseCount = (form.responseCount ?? 0) + 1;
  const recipientCount = form.recipientCount ?? 0;

  await (
    payload.update as (args: {
      collection: "email-data-collection-forms";
      id: string;
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "email-data-collection-forms",
    id: form.id,
    data: {
      lastImportAt: new Date().toISOString(),
      responseCount,
      responseRate:
        recipientCount > 0
          ? Math.min(100, Math.round((responseCount / recipientCount) * 100))
          : form.responseRate,
      responses: [
        ...prevResponses,
        {
          recipientEmail: fromEmail,
          receivedAt: new Date().toISOString(),
          rawMessage: message.subject,
          parsedData: {
            attachment: csvPick.filename,
            written,
            rejected: diff.rejected,
            unchanged: diff.unchanged,
          },
          status: "imported",
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId,
    action: "email_import.inbound",
    entityType: "email-data-collection-forms",
    entityId: form.id,
    after: {
      fromEmail,
      written,
      rejected: diff.rejected,
      unchanged: diff.unchanged,
      attachmentName: csvPick.filename,
      status,
    },
  });

  const logId = await writeLog({
    organisation: organisationId,
    form: form.id,
    fromEmail,
    subject: message.subject,
    status,
    reason:
      status === "success"
        ? undefined
        : `Partial import: ${diff.rejected} row(s) rejected`,
    attachmentName: csvPick.filename,
    recordsParsed: validated.rows.length,
    recordsWritten: written,
    recordsRejected: diff.rejected,
    recordsUnchanged: diff.unchanged,
    replyDelivery,
    details: {
      added: diff.added,
      changed: diff.changed,
      rejectedSample: rejectDetails,
    },
    providerMessageId: message.providerMessageId,
    durationMs: Date.now() - started,
  });

  return {
    status: 200,
    body: {
      ok: true,
      status,
      formId: form.id,
      written,
      rejected: diff.rejected,
      unchanged: diff.unchanged,
      replyDelivery,
      logId,
    },
  };
}

/** Generate a URL-safe inbound token for new forms. */
export function generateInboundToken(): string {
  return randomBytes(9).toString("base64url");
}
