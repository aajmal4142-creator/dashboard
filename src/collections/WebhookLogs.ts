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
    defaultColumns: ["webhook_id", "event_type", "status", "source", "createdAt"],
    description: "Audit trail of webhook delivery attempts and API data ingest batches",
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
      admin: {
        description:
          "Webhook registration id, or api-ingest:{batchId} for REST ingest logs",
      },
    },
    {
      name: "event_type",
      type: "text",
      required: true,
    },
    {
      name: "source",
      type: "select",
      defaultValue: "webhook",
      options: [
        { label: "Webhook", value: "webhook" },
        { label: "API ingest", value: "api" },
      ],
      index: true,
      admin: { description: "Origin of this log row" },
    },
    {
      name: "batch_id",
      type: "text",
      index: true,
      admin: { description: "Ingest batch id when event_type is data.ingest" },
    },
    {
      name: "record_count",
      type: "number",
      admin: { description: "Total records considered in an ingest batch" },
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
