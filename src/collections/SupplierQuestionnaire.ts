import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SUPPLIER_QUESTIONNAIRES_SLUG = "supplier-questionnaires" as const;

export const SupplierQuestionnaire: CollectionConfig = {
  slug: SUPPLIER_QUESTIONNAIRES_SLUG,
  admin: {
    useAsTitle: "supplier",
    defaultColumns: ["supplier", "status", "completionPercent", "submittedAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Invited", value: "invited" },
        /** @deprecated legacy — treat as invited in app code */
        { label: "Sent (legacy)", value: "sent" },
        { label: "In Progress", value: "in_progress" },
        { label: "Submitted", value: "submitted" },
        { label: "Reviewed", value: "reviewed" },
        { label: "Approved", value: "approved" },
        { label: "Archived", value: "archived" },
      ],
      index: true,
    },
    {
      name: "publicToken",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description: "Opaque token for the public /s/q/[token] form (no login)",
      },
    },
    {
      name: "responses",
      type: "json",
      admin: {
        description: "Questionnaire responses as JSON: { questionId: answer }",
      },
    },
    {
      name: "customSections",
      type: "json",
      admin: {
        description:
          "Org-defined sections: [{ id, title, questions: [{ id, label, type, required, options }] }]",
      },
    },
    {
      name: "completionPercent",
      type: "number",
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: "Percentage of questions answered (0-100)",
      },
    },
    {
      name: "invitedAt",
      type: "date",
      admin: {
        description: "When questionnaire invite was first sent",
      },
    },
    {
      name: "sentAt",
      type: "date",
      admin: {
        description: "When last invite or reminder email was sent",
      },
    },
    {
      name: "startedAt",
      type: "date",
      admin: {
        description: "When supplier first opened / started the form",
      },
    },
    {
      name: "submittedAt",
      type: "date",
      admin: {
        description: "When supplier submitted completed questionnaire",
      },
    },
    {
      name: "lastUpdatedAt",
      type: "date",
      admin: {
        description: "Last time responses were modified",
      },
    },
    {
      name: "reminderCount",
      type: "number",
      min: 0,
      defaultValue: 0,
      admin: {
        description: "Number of reminder emails sent (max 2: day 7 and 14)",
      },
    },
    {
      name: "lastReminderAt",
      type: "date",
      admin: {
        description: "When last reminder was sent",
      },
    },
    {
      name: "expiresAt",
      type: "date",
      admin: {
        description: "Questionnaire link expires at this date",
      },
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description: "Internal review notes",
      },
    },
    {
      name: "reviewNotes",
      type: "textarea",
      admin: {
        description: "Legacy alias kept for existing records — prefer notes",
      },
    },
    {
      name: "reviewedBy",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "User who reviewed the submission",
      },
    },
    {
      name: "reviewedAt",
      type: "date",
      admin: {
        description: "When the submission was reviewed",
      },
    },
    {
      name: "approvedBy",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "User who approved the submission",
      },
    },
    {
      name: "approvedAt",
      type: "date",
      admin: {
        description: "When the submission was approved",
      },
    },
  ],
};
