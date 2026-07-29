import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

const webhookRegistrationAccess = tenantAccess({ writeMin: "admin" });

export const WebhookRegistrations: CollectionConfig = {
  slug: "webhook-registrations",
  admin: {
    defaultColumns: ["webhook_id", "organisation", "status", "createdAt"],
    description: "Webhook endpoints registered by organizations for data ingestion",
  },
  access: webhookRegistrationAccess,
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
      unique: true,
      index: true,
      admin: { description: "UUID for webhook identification" },
    },
    {
      name: "endpoint_url",
      type: "text",
      required: true,
      validate: (val: unknown) => {
        if (!val || typeof val !== "string") return true;
        try {
          new URL(val);
          return true;
        } catch {
          return "Invalid URL";
        }
      },
    },
    {
      name: "secret",
      type: "text",
      required: true,
      admin: { description: "Encrypted webhook secret for HMAC-SHA256 validation" },
    },
    {
      name: "events",
      type: "json",
      required: true,
      admin: {
        description: 'Array of event types: ["datapoint.created", "datapoint.updated"]',
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      index: true,
    },
    {
      name: "last_triggered_at",
      type: "date",
      admin: { description: "Timestamp of last successful webhook trigger" },
    },
    {
      name: "retry_count",
      type: "number",
      defaultValue: 0,
      admin: { description: "Count of retried deliveries" },
    },
  ],
  timestamps: true,
};
