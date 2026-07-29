import type { CollectionConfig, Access } from "payload";

const webhookLogsRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const { resolveAccessibleOrgs, hasMinRole } = await import("@/lib/access/membership");
  const orgs = await resolveAccessibleOrgs(req);
  const adminOrgs = orgs.filter((o) => hasMinRole(o.role, "admin")).map((o) => o.orgId);
  if (adminOrgs.length === 0) return false;
  return { organisation: { in: adminOrgs } };
};

export const WebhookLogs: CollectionConfig = {
  slug: "webhook-logs",
  admin: {
    defaultColumns: ["webhook_id", "event_type", "status", "createdAt"],
    description: "Audit trail of webhook delivery attempts",
  },
  access: {
    read: webhookLogsRead,
    create: async () => true, // System-only via overrideAccess
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
      name: "webhook_id",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "event_type",
      type: "text",
      required: true,
    },
    {
      name: "payload",
      type: "json",
      admin: { description: "Event payload (sanitized of sensitive data)" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Retrying", value: "retrying" },
      ],
      index: true,
    },
    {
      name: "response_code",
      type: "number",
      admin: { description: "HTTP response code from webhook endpoint" },
    },
    {
      name: "error_message",
      type: "text",
      admin: { description: "Error details if delivery failed" },
    },
    {
      name: "attempt_number",
      type: "number",
      required: true,
      defaultValue: 1,
    },
    {
      name: "next_retry_at",
      type: "date",
      admin: { description: "When next retry is scheduled" },
    },
    {
      name: "duration_ms",
      type: "number",
      admin: { description: "Time taken for webhook delivery (ms)" },
    },
  ],
  timestamps: true,
};
