/**
 * Pure supplier engagement workflow helpers.
 * Zero I/O — status math, completion, reminder due checks, consent gate.
 */

export const ENGAGEMENT_STATUSES = [
  "draft",
  "invited",
  "in_progress",
  "submitted",
  "reviewed",
  "approved",
  "archived",
] as const;

export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

/** Reminder offsets after invite (days). Max two reminders. */
export const ENGAGEMENT_REMINDER_DAYS = [7, 14] as const;

export const QUESTIONNAIRE_TTL_DAYS = 60;

export type QuestionFieldType =
  "text" | "number" | "select" | "checkbox" | "textarea" | "yes_no";

export type QuestionnaireQuestion = {
  id: string;
  section: string;
  sectionLabel: string;
  question: string;
  type: QuestionFieldType;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
};

export type QuestionnaireTemplate = {
  version: string;
  questions: QuestionnaireQuestion[];
};

export type CustomSectionQuestion = {
  id: string;
  label: string;
  type: QuestionFieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type CustomSection = {
  id: string;
  title: string;
  questions: CustomSectionQuestion[];
};

const SECTION_LABELS: Record<string, string> = {
  company: "Company info",
  emissions: "Emissions data",
  supply_chain: "Supply chain",
  certifications: "Certifications",
  goals: "Sustainability goals",
};

/**
 * Pre-built ESG questionnaire sections.
 */
export function generateQuestionnaireTemplate(
  customSections: CustomSection[] = [],
): QuestionnaireTemplate {
  const questions: QuestionnaireQuestion[] = [
    {
      id: "company_name",
      section: "company",
      sectionLabel: SECTION_LABELS.company,
      question: "Company name",
      type: "text",
      required: true,
    },
    {
      id: "company_revenue",
      section: "company",
      sectionLabel: SECTION_LABELS.company,
      question: "Approximate annual revenue (USD)",
      type: "number",
      required: false,
      placeholder: "0",
    },
    {
      id: "company_employees",
      section: "company",
      sectionLabel: SECTION_LABELS.company,
      question: "Number of employees",
      type: "select",
      required: true,
      options: [
        { label: "<50", value: "lt_50" },
        { label: "50–250", value: "50_250" },
        { label: "250–1000", value: "250_1000" },
        { label: "1000–5000", value: "1000_5000" },
        { label: ">5000", value: "gt_5000" },
      ],
    },
    {
      id: "company_locations",
      section: "company",
      sectionLabel: SECTION_LABELS.company,
      question: "Primary operating locations (countries or cities)",
      type: "textarea",
      required: true,
      placeholder: "e.g., Mumbai, London, Singapore",
    },
    {
      id: "company_industry",
      section: "company",
      sectionLabel: SECTION_LABELS.company,
      question: "Primary industry / sector",
      type: "text",
      required: true,
      placeholder: "e.g., Manufacturing, Services, Technology",
    },
    {
      id: "company_contact",
      section: "company",
      sectionLabel: SECTION_LABELS.company,
      question: "Primary ESG contact name",
      type: "text",
      required: true,
    },

    {
      id: "scope1_tracked",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Do you track Scope 1 emissions (direct combustion)?",
      type: "yes_no",
      required: true,
    },
    {
      id: "scope1_estimate",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Approximate annual Scope 1 emissions (tCO2e)",
      type: "number",
      required: false,
      placeholder: "0",
    },
    {
      id: "scope2_tracked",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Do you track Scope 2 emissions (purchased energy)?",
      type: "yes_no",
      required: true,
    },
    {
      id: "scope2_estimate",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Approximate annual Scope 2 emissions (tCO2e)",
      type: "number",
      required: false,
      placeholder: "0",
    },
    {
      id: "scope2_renewable_pct",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Percentage of electricity from renewable sources (%)",
      type: "number",
      required: false,
      placeholder: "0",
    },
    {
      id: "scope3_tracked",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Do you track Scope 3 emissions?",
      type: "yes_no",
      required: true,
    },
    {
      id: "scope3_estimate",
      section: "emissions",
      sectionLabel: SECTION_LABELS.emissions,
      question: "Approximate annual Scope 3 emissions (tCO2e)",
      type: "number",
      required: false,
      placeholder: "0",
    },

    {
      id: "supply_chain_mapped",
      section: "supply_chain",
      sectionLabel: SECTION_LABELS.supply_chain,
      question: "Have you mapped your own key suppliers?",
      type: "yes_no",
      required: true,
    },
    {
      id: "supply_chain_count",
      section: "supply_chain",
      sectionLabel: SECTION_LABELS.supply_chain,
      question: "Approximate number of Tier 1 suppliers",
      type: "number",
      required: false,
      placeholder: "0",
    },
    {
      id: "supply_chain_engage",
      section: "supply_chain",
      sectionLabel: SECTION_LABELS.supply_chain,
      question: "Do you request emissions data from your suppliers?",
      type: "yes_no",
      required: true,
    },
    {
      id: "supply_chain_notes",
      section: "supply_chain",
      sectionLabel: SECTION_LABELS.supply_chain,
      question: "Describe your supply-chain sustainability programme",
      type: "textarea",
      required: false,
      placeholder: "Optional",
    },

    {
      id: "cert_iso14001",
      section: "certifications",
      sectionLabel: SECTION_LABELS.certifications,
      question: "ISO 14001 Environmental Management?",
      type: "yes_no",
      required: false,
    },
    {
      id: "cert_bcorp",
      section: "certifications",
      sectionLabel: SECTION_LABELS.certifications,
      question: "B Corp certified?",
      type: "yes_no",
      required: false,
    },
    {
      id: "cert_other",
      section: "certifications",
      sectionLabel: SECTION_LABELS.certifications,
      question: "Other certifications (ISO, EcoLabel, Carbon Trust, etc.)",
      type: "textarea",
      required: false,
      placeholder: "List certifications and expiry years if known",
    },

    {
      id: "goals_has_target",
      section: "goals",
      sectionLabel: SECTION_LABELS.goals,
      question: "Do you have an emissions reduction target?",
      type: "yes_no",
      required: true,
    },
    {
      id: "goals_detail",
      section: "goals",
      sectionLabel: SECTION_LABELS.goals,
      question: "Describe your sustainability goals",
      type: "textarea",
      required: false,
      placeholder: "e.g., Reduce 50% by 2030 vs 2024 baseline",
    },
    {
      id: "goals_sbti",
      section: "goals",
      sectionLabel: SECTION_LABELS.goals,
      question: "Is your target science-based (SBTi-aligned)?",
      type: "yes_no",
      required: false,
    },
    {
      id: "goals_priorities",
      section: "goals",
      sectionLabel: SECTION_LABELS.goals,
      question: "Top three sustainability priorities",
      type: "textarea",
      required: false,
      placeholder: "e.g., Renewable energy, Circular economy, Supply chain",
    },
  ];

  for (const section of customSections) {
    const sectionId = section.id.trim() || "custom";
    const sectionLabel = section.title.trim() || "Custom";
    for (const q of section.questions) {
      if (!q.id.trim()) continue;
      questions.push({
        id: `custom_${sectionId}_${q.id.trim()}`,
        section: `custom_${sectionId}`,
        sectionLabel,
        question: q.label,
        type: q.type,
        required: q.required === true,
        options: q.options,
      });
    }
  }

  return { version: "2.0", questions };
}

export function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Completion % against template (required + optional answered counts).
 */
export function calculateCompletion(
  responses: Record<string, unknown>,
  customSections: CustomSection[] = [],
): number {
  const template = generateQuestionnaireTemplate(customSections);
  if (template.questions.length === 0) return 0;
  const answered = template.questions.filter((q) => isAnswered(responses[q.id])).length;
  return Math.round((answered / template.questions.length) * 100);
}

/**
 * Required-field gate before submit.
 */
export function missingRequiredFields(
  responses: Record<string, unknown>,
  customSections: CustomSection[] = [],
): string[] {
  const template = generateQuestionnaireTemplate(customSections);
  return template.questions
    .filter((q) => q.required && !isAnswered(responses[q.id]))
    .map((q) => q.id);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidContactEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

/**
 * Consent + email must both pass before any outbound engagement email.
 */
export function canSendEngagementEmail(opts: {
  emailConsent: boolean | null | undefined;
  contactEmail: string | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (!opts.emailConsent) {
    return {
      ok: false,
      reason:
        "Supplier has not consented to email contact. Record consent before sending.",
    };
  }
  if (!isValidContactEmail(opts.contactEmail)) {
    return {
      ok: false,
      reason: "Supplier contact email is missing or invalid.",
    };
  }
  return { ok: true };
}

/**
 * Normalise legacy `sent` status from older records to `invited`.
 */
export function normaliseEngagementStatus(
  raw: string | null | undefined,
): EngagementStatus {
  if (raw === "sent") return "invited";
  if (
    raw === "draft" ||
    raw === "invited" ||
    raw === "in_progress" ||
    raw === "submitted" ||
    raw === "reviewed" ||
    raw === "approved" ||
    raw === "archived"
  ) {
    return raw;
  }
  return "draft";
}

export function engagementStatusLabel(status: EngagementStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "invited":
      return "Invited";
    case "in_progress":
      return "In progress";
    case "submitted":
      return "Submitted";
    case "reviewed":
      return "Reviewed";
    case "approved":
      return "Approved";
    case "archived":
      return "Archived";
  }
}

/**
 * Whether a reminder is due. Only for not-started invites (no startedAt).
 * reminderCount 0 → day 7; reminderCount 1 → day 14; then stop.
 */
export function engagementReminderDue(opts: {
  status: EngagementStatus;
  invitedAt: Date | string | null | undefined;
  startedAt: Date | string | null | undefined;
  reminderCount: number;
  now?: Date;
}): { due: boolean; dayOffset: number | null } {
  if (opts.status !== "invited") {
    return { due: false, dayOffset: null };
  }
  if (opts.startedAt) {
    return { due: false, dayOffset: null };
  }
  if (!opts.invitedAt) {
    return { due: false, dayOffset: null };
  }

  const invited =
    typeof opts.invitedAt === "string" ? new Date(opts.invitedAt) : opts.invitedAt;
  if (Number.isNaN(invited.getTime())) {
    return { due: false, dayOffset: null };
  }

  const now = opts.now ?? new Date();
  const daysSince = Math.floor(
    (now.getTime() - invited.getTime()) / (1000 * 60 * 60 * 24),
  );
  const already = Math.max(0, Math.floor(opts.reminderCount));

  for (let i = 0; i < ENGAGEMENT_REMINDER_DAYS.length; i += 1) {
    const day = ENGAGEMENT_REMINDER_DAYS[i];
    if (daysSince >= day && already <= i) {
      return { due: true, dayOffset: day };
    }
  }
  return { due: false, dayOffset: null };
}

export function daysSinceIso(
  iso: string | Date | null | undefined,
  now = new Date(),
): number | null {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function questionnaireExpiryFrom(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + QUESTIONNAIRE_TTL_DAYS);
  return d;
}

export function isQuestionnaireExpired(
  expiresAt: string | Date | null | undefined,
  now = new Date(),
): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return t.getTime() < now.getTime();
}

export function progressSummary(statuses: EngagementStatus[]): {
  total: number;
  completed: number;
  invited: number;
  inProgress: number;
  submitted: number;
  reviewed: number;
  approved: number;
} {
  const summary = {
    total: statuses.length,
    completed: 0,
    invited: 0,
    inProgress: 0,
    submitted: 0,
    reviewed: 0,
    approved: 0,
  };
  for (const s of statuses) {
    if (s === "invited") summary.invited += 1;
    if (s === "in_progress") summary.inProgress += 1;
    if (s === "submitted") summary.submitted += 1;
    if (s === "reviewed") summary.reviewed += 1;
    if (s === "approved") summary.approved += 1;
    if (s === "submitted" || s === "reviewed" || s === "approved") {
      summary.completed += 1;
    }
  }
  return summary;
}

export function parseCustomSections(raw: unknown): CustomSection[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomSection[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : "";
    const title = typeof rec.title === "string" ? rec.title : "";
    if (!id || !title) continue;
    const questionsRaw = Array.isArray(rec.questions) ? rec.questions : [];
    const questions: CustomSectionQuestion[] = [];
    for (const q of questionsRaw) {
      if (!q || typeof q !== "object") continue;
      const qr = q as Record<string, unknown>;
      const qid = typeof qr.id === "string" ? qr.id : "";
      const label = typeof qr.label === "string" ? qr.label : "";
      const type = qr.type;
      if (!qid || !label) continue;
      if (
        type !== "text" &&
        type !== "number" &&
        type !== "select" &&
        type !== "checkbox" &&
        type !== "textarea" &&
        type !== "yes_no"
      ) {
        continue;
      }
      questions.push({
        id: qid,
        label,
        type,
        required: qr.required === true,
        options: Array.isArray(qr.options)
          ? qr.options
              .filter(
                (o): o is { label: string; value: string } =>
                  !!o &&
                  typeof o === "object" &&
                  typeof (o as { label?: unknown }).label === "string" &&
                  typeof (o as { value?: unknown }).value === "string",
              )
              .map((o) => ({ label: o.label, value: o.value }))
          : undefined,
      });
    }
    out.push({ id, title, questions });
  }
  return out;
}

export function parseResponses(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}
