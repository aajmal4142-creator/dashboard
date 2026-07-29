import { getPayload } from "payload";
import config from "@/payload.config";
import type { SupplierQuestionnaire as SupplierQuestionnaireType } from "@/payload-types";

/**
 * Supplier ESG Questionnaire Service
 * Manages questionnaire lifecycle: send, track, remind, submit
 */

export interface QuestionnaireQuestion {
  id: string;
  section: string;
  question: string;
  type: "text" | "number" | "select" | "checkbox" | "textarea" | "yes_no";
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface QuestionnaireTemplate {
  version: string;
  questions: QuestionnaireQuestion[];
}

/**
 * Generate the standard questionnaire template
 * 30+ questions covering Scopes 1/2/3 and ESG commitments
 */
export function generateQuestionnaireTemplate(): QuestionnaireTemplate {
  return {
    version: "1.0",
    questions: [
      // Section A: Organizational Info (5 questions)
      {
        id: "org_name",
        section: "A",
        question: "Company Name",
        type: "text",
        required: true,
      },
      {
        id: "org_size",
        section: "A",
        question: "Number of Employees",
        type: "select",
        required: true,
        options: [
          { label: "<50", value: "lt_50" },
          { label: "50-250", value: "50_250" },
          { label: "250-1000", value: "250_1000" },
          { label: "1000-5000", value: "1000_5000" },
          { label: ">5000", value: "gt_5000" },
        ],
      },
      {
        id: "org_industry",
        section: "A",
        question: "Primary Industry/Sector",
        type: "text",
        required: true,
        placeholder: "e.g., Manufacturing, Services, Technology",
      },
      {
        id: "org_country",
        section: "A",
        question: "Country of Headquarters",
        type: "text",
        required: true,
      },
      {
        id: "org_contact",
        section: "A",
        question: "Primary ESG Contact Name",
        type: "text",
        required: true,
      },

      // Section B: Scope 1 Emissions (5 questions)
      {
        id: "scope1_tracked",
        section: "B",
        question: "Does your company track Scope 1 emissions (direct combustion)?",
        type: "yes_no",
        required: true,
      },
      {
        id: "scope1_estimate",
        section: "B",
        question: "Approximate annual Scope 1 emissions (tCO2e)",
        type: "number",
        required: false,
        placeholder: "0",
      },
      {
        id: "scope1_sources",
        section: "B",
        question: "Scope 1 emission sources (select all that apply)",
        type: "text",
        required: false,
        placeholder: "e.g., Vehicles, Equipment, Facilities, Manufacturing processes",
      },
      {
        id: "scope1_methodology",
        section: "B",
        question: "How is Scope 1 calculated?",
        type: "select",
        required: false,
        options: [
          { label: "Actual metered data", value: "metered" },
          { label: "Invoices/receipts", value: "invoices" },
          { label: "Estimates/calculations", value: "estimated" },
          { label: "Not calculated", value: "not_calculated" },
        ],
      },
      {
        id: "scope1_certification",
        section: "B",
        question: "Is Scope 1 data independently verified?",
        type: "yes_no",
        required: false,
      },

      // Section C: Scope 2 Emissions (5 questions)
      {
        id: "scope2_tracked",
        section: "C",
        question: "Does your company track Scope 2 emissions (purchased energy)?",
        type: "yes_no",
        required: true,
      },
      {
        id: "scope2_estimate",
        section: "C",
        question: "Approximate annual Scope 2 emissions (tCO2e)",
        type: "number",
        required: false,
        placeholder: "0",
      },
      {
        id: "scope2_renewable_pct",
        section: "C",
        question: "Percentage of electricity from renewable sources (%)",
        type: "number",
        required: false,
        placeholder: "0",
      },
      {
        id: "scope2_sources",
        section: "C",
        question: "Scope 2 emission sources (select all that apply)",
        type: "text",
        required: false,
        placeholder: "e.g., Purchased electricity, District heating, Cooling, Steam",
      },
      {
        id: "scope2_methodology",
        section: "C",
        question: "How is Scope 2 calculated?",
        type: "select",
        required: false,
        options: [
          { label: "Actual metered data", value: "metered" },
          { label: "Invoices/utility bills", value: "invoices" },
          { label: "Estimates", value: "estimated" },
          { label: "Not calculated", value: "not_calculated" },
        ],
      },

      // Section D: Scope 3 Engagement (4 questions)
      {
        id: "scope3_engaged",
        section: "D",
        question: "Does your company engage with customers on emissions?",
        type: "yes_no",
        required: true,
      },
      {
        id: "scope3_track_suppliers",
        section: "D",
        question:
          "Do you require or track supplier emissions data from your supply chain?",
        type: "yes_no",
        required: true,
      },
      {
        id: "scope3_product_eol",
        section: "D",
        question: "Do you track end-of-life emissions for your products?",
        type: "yes_no",
        required: false,
      },
      {
        id: "scope3_estimate",
        section: "D",
        question: "Approximate annual Scope 3 emissions (tCO2e)",
        type: "number",
        required: false,
        placeholder: "0",
      },

      // Section E: ESG Commitments & Certifications (8 questions)
      {
        id: "env_certifications",
        section: "E",
        question: "Environmental certifications (select all that apply)",
        type: "text",
        required: false,
        placeholder:
          "e.g., ISO 14001, B Corp, Fair Trade, Carbon Trust Standard, EcoLabel",
      },
      {
        id: "social_diversity_pct",
        section: "E",
        question: "Female representation in workforce (%)",
        type: "number",
        required: false,
        placeholder: "0",
      },
      {
        id: "social_policy",
        section: "E",
        question: "Do you have a formal equal pay policy?",
        type: "yes_no",
        required: false,
      },
      {
        id: "governance_ethics_code",
        section: "E",
        question: "Do you have a formal ethics/conduct code?",
        type: "yes_no",
        required: false,
      },
      {
        id: "governance_whistleblower",
        section: "E",
        question: "Do you have a whistleblower protection policy?",
        type: "yes_no",
        required: false,
      },
      {
        id: "governance_training",
        section: "E",
        question: "Do you provide compliance/ethics training to all employees?",
        type: "yes_no",
        required: false,
      },
      {
        id: "social_initiatives",
        section: "E",
        question: "Describe key social initiatives or community programs",
        type: "textarea",
        required: false,
        placeholder: "e.g., Health programs, Education scholarships, Community support",
      },

      // Section F: Sustainability Goals (4 questions)
      {
        id: "emissions_target",
        section: "F",
        question: "Does your company have an emissions reduction target?",
        type: "yes_no",
        required: true,
      },
      {
        id: "emissions_target_detail",
        section: "F",
        question: "Describe your emissions reduction target",
        type: "textarea",
        required: false,
        placeholder: "e.g., Reduce 50% by 2030 vs 2024 baseline, Net zero by 2050",
      },
      {
        id: "sbt_aligned",
        section: "F",
        question: "Is your target Science-Based (aligned with SBTi)?",
        type: "yes_no",
        required: false,
      },
      {
        id: "sustainability_priority",
        section: "F",
        question: "What are your top 3 sustainability priorities?",
        type: "textarea",
        required: false,
        placeholder: "e.g., Renewable energy, Circular economy, Supply chain engagement",
      },
    ],
  };
}

/**
 * Calculate questionnaire completion percentage
 */
export function calculateCompletion(responses: Record<string, unknown>): number {
  if (!responses || Object.keys(responses).length === 0) return 0;

  const template = generateQuestionnaireTemplate();
  const totalQuestions = template.questions.length;
  const answeredQuestions = Object.keys(responses).filter(
    (key) =>
      responses[key] !== null && responses[key] !== undefined && responses[key] !== "",
  ).length;

  return Math.round((answeredQuestions / totalQuestions) * 100);
}

/**
 * Send questionnaire to supplier via email
 */
export async function sendQuestionnaire(
  supplierId: string,
  supplierEmail: string,
  inviteToken: string,
  _orgName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config });

    // Generate questionnaire link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const questionnaireLink = `${baseUrl}/supplier/questionnaire/${inviteToken}`;

    // Send email (implement via your email service)
    // For now, just log
    console.log(`[questionnaire] Sending to ${supplierEmail}: ${questionnaireLink}`);

    // Update supplier with sent timestamp
    await payload.update({
      collection: "supplier-questionnaires",
      where: { id: { equals: supplierId } },
      data: {
        status: "sent",
        sentAt: new Date().toISOString(),
        invitedAt: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Submit questionnaire responses
 */
export async function submitQuestionnaire(
  supplierId: string,
  responses: Record<string, unknown>,
): Promise<{ success: boolean; completionPercent: number; error?: string }> {
  try {
    const payload = await getPayload({ config });
    const completionPercent = calculateCompletion(responses);

    // Create or update questionnaire record
    const existing = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      await payload.update({
        collection: "supplier-questionnaires",
        id: existing.docs[0].id,
        data: {
          responses,
          completionPercent,
          status: "submitted",
          submittedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
        },
      });
    } else {
      // This shouldn't happen in normal flow, but handle it
      console.warn(`No questionnaire found for supplier ${supplierId}, creating new`);
    }

    return { success: true, completionPercent };
  } catch (error) {
    return {
      success: false,
      completionPercent: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get questionnaire completion for supplier
 */
export async function getCompletion(supplierId: string): Promise<{
  completionPercent: number;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
}> {
  try {
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
    });

    if (result.docs.length === 0) {
      return {
        completionPercent: 0,
        status: "not_started",
        totalQuestions: generateQuestionnaireTemplate().questions.length,
        answeredQuestions: 0,
      };
    }

    const questionnaire = result.docs[0] as unknown as SupplierQuestionnaireType;
    const responses = questionnaire.responses as Record<string, unknown>;
    const completionPercent = calculateCompletion(responses || {});
    const template = generateQuestionnaireTemplate();

    return {
      completionPercent,
      status: questionnaire.status || "draft",
      totalQuestions: template.questions.length,
      answeredQuestions: responses ? Object.keys(responses).length : 0,
    };
  } catch (error) {
    console.error("Error getting completion:", error);
    return {
      completionPercent: 0,
      status: "error",
      totalQuestions: generateQuestionnaireTemplate().questions.length,
      answeredQuestions: 0,
    };
  }
}

/**
 * Send reminder email to supplier
 * Called at 14, 21, and 30 days after initial send
 */
export async function remindSupplier(
  supplierId: string,
  supplierEmail: string,
  reminderCount: number,
  inviteToken: string,
  _orgName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const questionnaireLink = `${baseUrl}/supplier/questionnaire/${inviteToken}`;

    // Send reminder email
    // TODO: Send email reminder using actual email service
    console.log(
      `[questionnaire-reminder] Day ${reminderCount * 7}: ${supplierEmail} | Link: ${questionnaireLink}`,
    );

    // Update reminder count
    await payload.update({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      data: {
        reminderCount: reminderCount + 1,
        lastReminderAt: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if supplier needs reminder email
 * Returns true if 14, 21, or 30 days have passed since last contact
 */
export function needsReminder(
  sentAt: Date | undefined,
  lastReminderAt: Date | undefined,
  _reminderCount: number,
): boolean {
  if (!sentAt) return false;

  const lastContactDate = lastReminderAt || sentAt;
  const daysSinceContact = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Remind at days 14, 21, 30
  const reminderDays = [14, 21, 30];
  return reminderDays.includes(daysSinceContact);
}
