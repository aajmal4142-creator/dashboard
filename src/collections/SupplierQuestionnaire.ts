import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SupplierQuestionnaire: CollectionConfig = {
  slug: "supplier-questionnaires",
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
        { label: "Sent", value: "sent" },
        { label: "In Progress", value: "in_progress" },
        { label: "Submitted", value: "submitted" },
        { label: "Reviewed", value: "reviewed" },
      ],
      index: true,
    },
    {
      name: "responses",
      type: "json",
      admin: {
        description: "Questionnaire responses as JSON: { questionId: answer }",
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
        description: "When questionnaire was sent to supplier",
      },
    },
    {
      name: "sentAt",
      type: "date",
      admin: {
        description: "When last sent/reminder was sent",
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
        description: "Number of reminder emails sent",
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
      name: "reviewNotes",
      type: "textarea",
      admin: {
        description: "Admin notes after review",
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
  ],
};
