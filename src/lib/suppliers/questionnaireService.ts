/**
 * Supplier ESG questionnaire — thin re-exports + legacy helpers.
 * Prefer `@/lib/suppliers/engagementService` and `engagementWorkflow` for new code.
 */

export {
  calculateCompletion,
  generateQuestionnaireTemplate,
  type QuestionnaireQuestion,
  type QuestionnaireTemplate,
} from "./engagementWorkflow";

export {
  engagementReminderDue as needsReminderDetailed,
  canSendEngagementEmail,
} from "./engagementWorkflow";

import {
  calculateCompletion,
  generateQuestionnaireTemplate,
  engagementReminderDue,
  normaliseEngagementStatus,
} from "./engagementWorkflow";

/**
 * Legacy reminder check (14/21/30). Prefer engagementReminderDue (7/14).
 */
export function needsReminder(
  sentAt: Date | undefined,
  lastReminderAt: Date | undefined,
  reminderCount: number,
): boolean {
  const due = engagementReminderDue({
    status: "invited",
    invitedAt: sentAt,
    startedAt: undefined,
    reminderCount,
  });
  if (due.due) return true;
  // Preserve old day-21/30 behaviour for callers that still pass lastReminderAt
  if (!sentAt) return false;
  const lastContactDate = lastReminderAt || sentAt;
  const daysSinceContact = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return [21, 30].includes(daysSinceContact) && reminderCount < 3;
}

export async function sendQuestionnaire(
  supplierId: string,
  _supplierEmail: string,
  _inviteToken: string,
  orgName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sendSupplierQuestionnaire } = await import("./engagementService");
    const { getPayload } = await import("payload");
    const config = (await import("@/payload.config")).default;
    const payload = await getPayload({ config });
    const supplier = await payload.findByID({
      collection: "suppliers",
      id: supplierId,
      overrideAccess: true,
    });
    const orgId =
      typeof supplier.organisation === "object" && supplier.organisation !== null
        ? String(supplier.organisation.id)
        : String(supplier.organisation);
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    await sendSupplierQuestionnaire({
      organisationId: orgId,
      orgName,
      supplierId,
      origin,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function submitQuestionnaire(
  supplierId: string,
  responses: Record<string, unknown>,
): Promise<{ success: boolean; completionPercent: number; error?: string }> {
  try {
    const { getPayload } = await import("payload");
    const config = (await import("@/payload.config")).default;
    const payload = await getPayload({ config });
    const found = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
      overrideAccess: true,
    });
    const doc = found.docs[0];
    if (!doc?.publicToken) {
      return {
        success: false,
        completionPercent: 0,
        error: "No questionnaire found for supplier",
      };
    }
    const { submitPublicResponses } = await import("./engagementService");
    const result = await submitPublicResponses({
      token: String(doc.publicToken),
      responses,
    });
    if (result.missing.length > 0) {
      return {
        success: false,
        completionPercent: result.completionPercent,
        error: `Missing required fields: ${result.missing.join(", ")}`,
      };
    }
    return { success: true, completionPercent: result.completionPercent };
  } catch (error) {
    return {
      success: false,
      completionPercent: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCompletion(supplierId: string): Promise<{
  completionPercent: number;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
}> {
  try {
    const { getPayload } = await import("payload");
    const config = (await import("@/payload.config")).default;
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
      overrideAccess: true,
    });
    const template = generateQuestionnaireTemplate();
    if (result.docs.length === 0) {
      return {
        completionPercent: 0,
        status: "not_started",
        totalQuestions: template.questions.length,
        answeredQuestions: 0,
      };
    }
    const questionnaire = result.docs[0];
    const responses =
      questionnaire.responses &&
      typeof questionnaire.responses === "object" &&
      !Array.isArray(questionnaire.responses)
        ? (questionnaire.responses as Record<string, unknown>)
        : {};
    const completionPercent = calculateCompletion(responses);
    return {
      completionPercent,
      status: normaliseEngagementStatus(questionnaire.status),
      totalQuestions: template.questions.length,
      answeredQuestions: Object.keys(responses).filter(
        (k) => responses[k] !== null && responses[k] !== undefined && responses[k] !== "",
      ).length,
    };
  } catch {
    return {
      completionPercent: 0,
      status: "error",
      totalQuestions: generateQuestionnaireTemplate().questions.length,
      answeredQuestions: 0,
    };
  }
}

export async function remindSupplier(
  supplierId: string,
  _supplierEmail: string,
  reminderCount: number,
  inviteToken: string,
  orgName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sendTransactionalEmail } = await import("@/lib/email/send");
    const { getPayload } = await import("payload");
    const config = (await import("@/payload.config")).default;
    const payload = await getPayload({ config });
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const link = `${baseUrl}/s/q/${inviteToken}`;
    await sendTransactionalEmail({
      to: _supplierEmail,
      subject: `Reminder: ${orgName} still needs your ESG questionnaire`,
      html: `<p>Reminder from ${orgName}.</p><p><a href="${link}">${link}</a></p>`,
    });
    const found = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
      overrideAccess: true,
    });
    if (found.docs[0]) {
      await payload.update({
        collection: "supplier-questionnaires",
        id: found.docs[0].id,
        data: {
          reminderCount: reminderCount + 1,
          lastReminderAt: new Date().toISOString(),
        },
        overrideAccess: true,
      });
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
