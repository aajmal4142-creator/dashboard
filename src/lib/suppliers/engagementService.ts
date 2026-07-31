/**
 * Supplier engagement I/O — create/send/submit/review questionnaires + reminders.
 */

import { randomBytes } from "node:crypto";

import { getPayload, type Payload } from "payload";

import { SUPPLIER_QUESTIONNAIRES_SLUG } from "@/collections/SupplierQuestionnaire";
import { sendTransactionalEmail } from "@/lib/email/send";
import config from "@/payload.config";

import {
  calculateCompletion,
  canSendEngagementEmail,
  engagementReminderDue,
  generateQuestionnaireTemplate,
  isQuestionnaireExpired,
  missingRequiredFields,
  normaliseEngagementStatus,
  parseCustomSections,
  parseResponses,
  progressSummary,
  questionnaireExpiryFrom,
  type CustomSection,
  type EngagementStatus,
  type QuestionnaireTemplate,
} from "./engagementWorkflow";

export type EngagementQuestionnaireDto = {
  id: string;
  organisationId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  status: EngagementStatus;
  publicToken: string | null;
  completionPercent: number;
  responses: Record<string, unknown>;
  customSections: CustomSection[];
  notes: string | null;
  invitedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  sentAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  expiresAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  lastReminderDaysAgo: number | null;
};

function relationId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

function daysAgo(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Math.floor((now.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

function mapDoc(doc: {
  id: string;
  organisation: unknown;
  supplier: unknown;
  status?: string | null;
  publicToken?: string | null;
  completionPercent?: number | null;
  responses?: unknown;
  customSections?: unknown;
  notes?: string | null;
  reviewNotes?: string | null;
  invitedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  sentAt?: string | null;
  lastReminderAt?: string | null;
  reminderCount?: number | null;
  expiresAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
}): EngagementQuestionnaireDto {
  const supplierObj =
    doc.supplier && typeof doc.supplier === "object"
      ? (doc.supplier as { id?: string; name?: string; contactEmail?: string })
      : null;
  return {
    id: doc.id,
    organisationId: relationId(doc.organisation) ?? "",
    supplierId: relationId(doc.supplier) ?? "",
    supplierName: supplierObj?.name ?? "",
    supplierEmail: supplierObj?.contactEmail ?? "",
    status: normaliseEngagementStatus(doc.status),
    publicToken: doc.publicToken ?? null,
    completionPercent: doc.completionPercent ?? 0,
    responses: parseResponses(doc.responses),
    customSections: parseCustomSections(doc.customSections),
    notes: doc.notes ?? doc.reviewNotes ?? null,
    invitedAt: doc.invitedAt ? String(doc.invitedAt) : null,
    startedAt: doc.startedAt ? String(doc.startedAt) : null,
    submittedAt: doc.submittedAt ? String(doc.submittedAt) : null,
    sentAt: doc.sentAt ? String(doc.sentAt) : null,
    lastReminderAt: doc.lastReminderAt ? String(doc.lastReminderAt) : null,
    reminderCount: doc.reminderCount ?? 0,
    expiresAt: doc.expiresAt ? String(doc.expiresAt) : null,
    reviewedAt: doc.reviewedAt ? String(doc.reviewedAt) : null,
    approvedAt: doc.approvedAt ? String(doc.approvedAt) : null,
    lastReminderDaysAgo: daysAgo(doc.lastReminderAt ? String(doc.lastReminderAt) : null),
  };
}

async function getPayloadClient(): Promise<Payload> {
  return getPayload({ config });
}

export async function findQuestionnaireForSupplier(
  payload: Payload,
  organisationId: string,
  supplierId: string,
): Promise<EngagementQuestionnaireDto | null> {
  const found = await payload.find({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { supplier: { equals: supplierId } },
        { status: { not_equals: "archived" } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
    depth: 1,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  return doc ? mapDoc(doc) : null;
}

export async function listOrgQuestionnaires(
  payload: Payload,
  organisationId: string,
): Promise<{
  questionnaires: EngagementQuestionnaireDto[];
  progress: ReturnType<typeof progressSummary>;
}> {
  const found = await payload.find({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { status: { not_equals: "archived" } },
      ],
    },
    limit: 500,
    sort: "-updatedAt",
    depth: 1,
    overrideAccess: true,
  });
  const questionnaires = found.docs.map((d) => mapDoc(d));
  return {
    questionnaires,
    progress: progressSummary(questionnaires.map((q) => q.status)),
  };
}

export async function findByPublicToken(
  payload: Payload,
  token: string,
): Promise<EngagementQuestionnaireDto | null> {
  const found = await payload.find({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    where: { publicToken: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  return doc ? mapDoc(doc) : null;
}

function buildInviteHtml(opts: {
  orgName: string;
  supplierName: string;
  link: string;
  expiresIso: string;
  reminder?: boolean;
  dayOffset?: number;
}): string {
  const headline = opts.reminder
    ? `Reminder: ${opts.orgName} still needs your ESG questionnaire`
    : `${opts.orgName} invites you to complete an ESG questionnaire`;
  const body = opts.reminder
    ? `<p>This is a day-${opts.dayOffset ?? ""} reminder. Please complete the form when you can.</p>`
    : `<p>${opts.orgName} requests ESG information from ${opts.supplierName}.</p>`;
  return `<p>${headline}</p>
${body}
<p>Complete the form (no account required): <a href="${opts.link}">${opts.link}</a></p>
<p>This link expires on ${opts.expiresIso.slice(0, 10)}.</p>`;
}

export type SendQuestionnaireResult = {
  questionnaire: EngagementQuestionnaireDto;
  link: string;
  delivery: "resend" | "console" | "failed";
  error?: string;
};

/**
 * Create or refresh questionnaire + send invite email (consent-gated).
 */
export async function sendSupplierQuestionnaire(opts: {
  organisationId: string;
  orgName: string;
  supplierId: string;
  origin: string;
  customSections?: CustomSection[];
}): Promise<SendQuestionnaireResult> {
  const payload = await getPayloadClient();

  let supplier;
  try {
    supplier = await payload.findByID({
      collection: "suppliers",
      id: opts.supplierId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    throw new Error("Supplier not found");
  }

  const orgId = relationId(supplier.organisation);
  if (orgId !== opts.organisationId) {
    throw new Error("Supplier not found");
  }

  const consent = canSendEngagementEmail({
    emailConsent: Boolean((supplier as { emailConsent?: boolean | null }).emailConsent),
    contactEmail: supplier.contactEmail,
  });
  if (!consent.ok) {
    throw new Error(consent.reason);
  }

  const existing = await findQuestionnaireForSupplier(
    payload,
    opts.organisationId,
    opts.supplierId,
  );

  const nowIso = new Date().toISOString();
  const expires = questionnaireExpiryFrom();
  const token = existing?.publicToken ?? newPublicToken();
  const customSections = opts.customSections ?? existing?.customSections ?? [];

  let docId: string;
  if (existing) {
    const updated = await payload.update({
      collection: SUPPLIER_QUESTIONNAIRES_SLUG,
      id: existing.id,
      data: {
        status: "invited",
        publicToken: token,
        sentAt: nowIso,
        invitedAt: existing.invitedAt ?? nowIso,
        expiresAt: expires.toISOString(),
        customSections,
        reminderCount: existing.status === "invited" ? existing.reminderCount : 0,
      },
      depth: 1,
      overrideAccess: true,
    });
    docId = updated.id;
  } else {
    const created = await payload.create({
      collection: SUPPLIER_QUESTIONNAIRES_SLUG,
      data: {
        organisation: opts.organisationId,
        supplier: opts.supplierId,
        status: "invited",
        publicToken: token,
        invitedAt: nowIso,
        sentAt: nowIso,
        expiresAt: expires.toISOString(),
        customSections,
        completionPercent: 0,
        reminderCount: 0,
        responses: {},
      },
      depth: 1,
      overrideAccess: true,
    });
    docId = created.id;
  }

  const link = `${opts.origin}/s/q/${token}`;
  const email = await sendTransactionalEmail({
    to: supplier.contactEmail,
    subject: `${opts.orgName} invites you to complete an ESG questionnaire`,
    html: buildInviteHtml({
      orgName: opts.orgName,
      supplierName: supplier.name,
      link,
      expiresIso: expires.toISOString(),
    }),
  });

  const refreshed = await payload.findByID({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    id: docId,
    depth: 1,
    overrideAccess: true,
  });

  return {
    questionnaire: mapDoc(refreshed),
    link,
    delivery: email.delivery,
    error: email.error,
  };
}

export type PublicFormPayload = {
  token: string;
  orgName: string;
  supplierName: string;
  status: EngagementStatus;
  expired: boolean;
  alreadySubmitted: boolean;
  expiresAt: string | null;
  template: QuestionnaireTemplate;
  responses: Record<string, unknown>;
  completionPercent: number;
};

export async function loadPublicForm(token: string): Promise<PublicFormPayload | null> {
  const payload = await getPayloadClient();
  const found = await payload.find({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    where: { publicToken: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) return null;

  const dto = mapDoc(doc);
  const status = dto.status;

  if (status === "archived") return null;

  // Mark in progress on first open
  if (status === "invited" && !isQuestionnaireExpired(dto.expiresAt)) {
    const nowIso = new Date().toISOString();
    await payload.update({
      collection: SUPPLIER_QUESTIONNAIRES_SLUG,
      id: doc.id,
      data: {
        status: "in_progress",
        startedAt: dto.startedAt ?? nowIso,
        lastUpdatedAt: nowIso,
      },
      overrideAccess: true,
    });
    dto.status = "in_progress";
    dto.startedAt = dto.startedAt ?? nowIso;
  }

  const org =
    doc.organisation && typeof doc.organisation === "object"
      ? (doc.organisation as { name?: string })
      : null;
  const supplier =
    doc.supplier && typeof doc.supplier === "object"
      ? (doc.supplier as { name?: string })
      : null;

  return {
    token,
    orgName: org?.name ?? "",
    supplierName: supplier?.name ?? dto.supplierName,
    status: dto.status,
    expired: isQuestionnaireExpired(dto.expiresAt),
    alreadySubmitted:
      dto.status === "submitted" ||
      dto.status === "reviewed" ||
      dto.status === "approved",
    expiresAt: dto.expiresAt,
    template: generateQuestionnaireTemplate(dto.customSections),
    responses: dto.responses,
    completionPercent: dto.completionPercent,
  };
}

export async function submitPublicResponses(opts: {
  token: string;
  responses: Record<string, unknown>;
  draft?: boolean;
}): Promise<{
  completionPercent: number;
  status: EngagementStatus;
  missing: string[];
}> {
  const payload = await getPayloadClient();
  const found = await payload.find({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    where: { publicToken: { equals: opts.token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) {
    throw new Error("Questionnaire not found");
  }

  const status = normaliseEngagementStatus(doc.status);
  if (status === "archived") {
    throw new Error("Questionnaire is archived");
  }
  if (isQuestionnaireExpired(doc.expiresAt ? String(doc.expiresAt) : null)) {
    throw new Error("This questionnaire link has expired");
  }
  if (status === "reviewed" || status === "approved") {
    throw new Error("This questionnaire has already been reviewed");
  }

  const customSections = parseCustomSections(doc.customSections);
  const responses = parseResponses(opts.responses);
  const completionPercent = calculateCompletion(responses, customSections);
  const missing = missingRequiredFields(responses, customSections);
  const nowIso = new Date().toISOString();

  if (opts.draft) {
    await payload.update({
      collection: SUPPLIER_QUESTIONNAIRES_SLUG,
      id: doc.id,
      data: {
        responses,
        completionPercent,
        status: status === "invited" ? "in_progress" : status,
        startedAt: doc.startedAt ?? nowIso,
        lastUpdatedAt: nowIso,
      },
      overrideAccess: true,
    });
    return {
      completionPercent,
      status: status === "invited" ? "in_progress" : status,
      missing,
    };
  }

  if (missing.length > 0) {
    return { completionPercent, status, missing };
  }

  await payload.update({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    id: doc.id,
    data: {
      responses,
      completionPercent,
      status: "submitted",
      submittedAt: nowIso,
      startedAt: doc.startedAt ?? nowIso,
      lastUpdatedAt: nowIso,
    },
    overrideAccess: true,
  });

  const supplierId = relationId(doc.supplier);
  if (supplierId) {
    try {
      const supplier = await payload.findByID({
        collection: "suppliers",
        id: supplierId,
        overrideAccess: true,
      });
      const existingEsg =
        supplier.esgData && typeof supplier.esgData === "object"
          ? (supplier.esgData as Record<string, unknown>)
          : {};
      await payload.update({
        collection: "suppliers",
        id: supplierId,
        data: {
          esgData: {
            ...existingEsg,
            dataCompletionPercent: completionPercent,
            lastDataUpdateAt: nowIso,
          },
        },
        overrideAccess: true,
        context: { skipRiskRecalc: false },
      });
    } catch {
      /* non-fatal */
    }
  }

  return { completionPercent, status: "submitted", missing: [] };
}

export async function reviewQuestionnaire(opts: {
  organisationId: string;
  supplierId: string;
  userId: string;
  notes?: string;
  approve?: boolean;
  archive?: boolean;
}): Promise<EngagementQuestionnaireDto> {
  const payload = await getPayloadClient();
  const existing = await findQuestionnaireForSupplier(
    payload,
    opts.organisationId,
    opts.supplierId,
  );
  if (!existing) {
    throw new Error("Questionnaire not found");
  }

  const status = existing.status;
  if (status === "draft" || status === "invited" || status === "in_progress") {
    throw new Error("Cannot review until the supplier has submitted");
  }

  const nowIso = new Date().toISOString();
  let nextStatus: EngagementStatus = "reviewed";
  if (opts.archive) nextStatus = "archived";
  else if (opts.approve) nextStatus = "approved";

  const updated = await payload.update({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    id: existing.id,
    data: {
      status: nextStatus,
      notes: opts.notes ?? existing.notes,
      reviewNotes: opts.notes ?? existing.notes,
      reviewedBy: opts.userId,
      reviewedAt: existing.reviewedAt ?? nowIso,
      ...(opts.approve ? { approvedBy: opts.userId, approvedAt: nowIso } : {}),
    },
    depth: 1,
    overrideAccess: true,
  });

  return mapDoc(updated);
}

export type ReminderCronResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{
    id: string;
    supplierId: string;
    dayOffset: number | null;
    delivery: string;
    error?: string;
  }>;
};

/**
 * Cron: send day-7 / day-14 reminders for invited (not started) questionnaires.
 */
export async function sendEngagementReminders(
  origin: string,
): Promise<ReminderCronResult> {
  const payload = await getPayloadClient();
  const found = await payload.find({
    collection: SUPPLIER_QUESTIONNAIRES_SLUG,
    where: {
      status: { in: ["invited", "sent"] },
    },
    limit: 200,
    depth: 1,
    overrideAccess: true,
  });

  const candidates = found.docs.filter((doc) => !doc.startedAt);

  const results: ReminderCronResult["results"] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of candidates) {
    const dto = mapDoc(doc);
    const due = engagementReminderDue({
      status: dto.status,
      invitedAt: dto.invitedAt,
      startedAt: dto.startedAt,
      reminderCount: dto.reminderCount,
    });
    if (!due.due || due.dayOffset === null) {
      skipped += 1;
      continue;
    }

    const supplier =
      doc.supplier && typeof doc.supplier === "object"
        ? (doc.supplier as {
            id: string;
            name?: string;
            contactEmail?: string;
            emailConsent?: boolean | null;
            organisation?: unknown;
          })
        : null;
    if (!supplier?.contactEmail || !dto.publicToken) {
      skipped += 1;
      continue;
    }

    const consent = canSendEngagementEmail({
      emailConsent: Boolean(supplier.emailConsent),
      contactEmail: supplier.contactEmail,
    });
    if (!consent.ok) {
      skipped += 1;
      results.push({
        id: dto.id,
        supplierId: dto.supplierId,
        dayOffset: due.dayOffset,
        delivery: "skipped",
        error: consent.reason,
      });
      continue;
    }

    const org =
      doc.organisation && typeof doc.organisation === "object"
        ? (doc.organisation as { name?: string })
        : null;
    const orgName = org?.name ?? "ClearESG customer";
    const link = `${origin}/s/q/${dto.publicToken}`;

    const email = await sendTransactionalEmail({
      to: supplier.contactEmail,
      subject: `Reminder: ${orgName} still needs your ESG questionnaire`,
      html: buildInviteHtml({
        orgName,
        supplierName: supplier.name ?? "supplier",
        link,
        expiresIso: dto.expiresAt ?? new Date().toISOString(),
        reminder: true,
        dayOffset: due.dayOffset,
      }),
    });

    if (email.delivery === "failed") {
      failed += 1;
      results.push({
        id: dto.id,
        supplierId: dto.supplierId,
        dayOffset: due.dayOffset,
        delivery: "failed",
        error: email.error,
      });
      continue;
    }

    const nowIso = new Date().toISOString();
    await payload.update({
      collection: SUPPLIER_QUESTIONNAIRES_SLUG,
      id: dto.id,
      data: {
        reminderCount: dto.reminderCount + 1,
        lastReminderAt: nowIso,
        sentAt: nowIso,
      },
      overrideAccess: true,
    });

    sent += 1;
    results.push({
      id: dto.id,
      supplierId: dto.supplierId,
      dayOffset: due.dayOffset,
      delivery: email.delivery,
    });
  }

  return {
    attempted: candidates.length,
    sent,
    skipped,
    failed,
    results,
  };
}
