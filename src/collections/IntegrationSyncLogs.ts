import type { CollectionConfig } from "payload";

import { accessibleOrgIds } from "@/lib/access/membership";

export const IntegrationSyncLogs: CollectionConfig = {
  slug: "integration-sync-logs",
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "integrationId",
      "provider",
      "status",
      "recordsProcessed",
      "createdAt",
    ],
  },
  access: {
    read: async ({ req }) => {
      if (!req.user) return false;
      const ids = await accessibleOrgIds(req);
      if (ids.length === 0) return false;
      return { organisationId: { in: ids } };
    },
    create: async ({ req }) => Boolean(req.user),
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "organisationId",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "integrationId",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Foreign key to connection (accounting-connections, etc.)" },
    },
    {
      name: "provider",
      type: "select",
      required: true,
      options: [
        { label: "Xero", value: "xero" },
        { label: "QuickBooks", value: "quickbooks" },
        { label: "Wave", value: "wave" },
        { label: "CSV", value: "csv" },
        { label: "Webhook", value: "webhook" },
        { label: "Jira", value: "jira" },
        { label: "Linear", value: "linear" },
      ],
    },
    {
      name: "status",
      type: "select",
      options: [
        { label: "Success", value: "success" },
        { label: "Partial", value: "partial" },
        { label: "Failed", value: "failed" },
      ],
    },
    { name: "recordsProcessed", type: "number", defaultValue: 0 },
    { name: "recordsFailed", type: "number", defaultValue: 0 },
    {
      name: "details",
      type: "json",
      admin: { description: "Sync details: counts, mapped fields, warnings" },
    },
    {
      name: "errors",
      type: "array",
      fields: [
        { name: "message", type: "text" },
        { name: "recordId", type: "text" },
      ],
      admin: { description: "Error log for failed records" },
    },
    {
      name: "syncDurationMs",
      type: "number",
      admin: { description: "How long the sync took" },
    },
    { name: "triggeredBy", type: "text", admin: { description: "User ID or 'auto'" } },
  ],
};
