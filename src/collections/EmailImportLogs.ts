import type { CollectionConfig, Access } from "payload";

export const EMAIL_IMPORT_LOGS_SLUG = "email-import-logs" as const;

const emailImportLogsRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const { resolveAccessibleOrgs, hasMinRole } = await import("@/lib/access/membership");
  const orgs = await resolveAccessibleOrgs(req);
  const adminOrgs = orgs.filter((o) => hasMinRole(o.role, "admin")).map((o) => o.orgId);
  if (adminOrgs.length === 0) return false;
  return { organisation: { in: adminOrgs } };
};

export const EmailImportLogs: CollectionConfig = {
  slug: EMAIL_IMPORT_LOGS_SLUG,
  admin: {
    defaultColumns: ["form", "fromEmail", "status", "recordsWritten", "createdAt"],
    description: "Audit trail for inbound email CSV data imports",
  },
  access: {
    read: emailImportLogsRead,
    create: async () => true,
    update: async () => false,
    delete: async () => false,
  },
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "form",
      type: "relationship",
      relationTo: "email-data-collection-forms",
      index: true,
    },
    {
      name: "fromEmail",
      type: "email",
      required: true,
      index: true,
      admin: { description: "Sender address (never log secrets)" },
    },
    {
      name: "subject",
      type: "text",
    },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Success", value: "success" },
        { label: "Partial", value: "partial" },
        { label: "Rejected", value: "rejected" },
        { label: "Failed", value: "failed" },
      ],
    },
    {
      name: "reason",
      type: "text",
      admin: { description: "Human-readable reject/fail reason" },
    },
    { name: "attachmentName", type: "text" },
    { name: "recordsParsed", type: "number", defaultValue: 0 },
    { name: "recordsWritten", type: "number", defaultValue: 0 },
    { name: "recordsRejected", type: "number", defaultValue: 0 },
    { name: "recordsUnchanged", type: "number", defaultValue: 0 },
    {
      name: "replyDelivery",
      type: "select",
      options: [
        { label: "Resend", value: "resend" },
        { label: "Console", value: "console" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" },
      ],
    },
    {
      name: "details",
      type: "json",
      admin: {
        description: "Sanitized summary (row diffs, errors — no secrets)",
      },
    },
    {
      name: "providerMessageId",
      type: "text",
      index: true,
      admin: { description: "Resend/email provider message id when available" },
    },
    {
      name: "durationMs",
      type: "number",
    },
  ],
  timestamps: true,
};
