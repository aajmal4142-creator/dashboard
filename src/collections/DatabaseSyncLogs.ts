import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const DATABASE_SYNC_LOGS_SLUG = "database-sync-logs" as const;

export const DatabaseSyncLogs: CollectionConfig = {
  slug: DATABASE_SYNC_LOGS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "connection",
      "status",
      "recordsProcessed",
      "triggeredBy",
      "createdAt",
    ],
  },
  access: {
    ...tenantAccess({ writeMin: "admin" }),
    update: () => false,
    delete: () => false,
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
      name: "connection",
      type: "relationship",
      relationTo: "database-connections",
      required: true,
      index: true,
    },
    {
      name: "engine",
      type: "select",
      required: true,
      options: [
        { label: "PostgreSQL", value: "postgresql" },
        { label: "MySQL", value: "mysql" },
        { label: "Google BigQuery", value: "bigquery" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Running", value: "running" },
        { label: "Success", value: "success" },
        { label: "Partial", value: "partial" },
        { label: "Failed", value: "failed" },
      ],
      index: true,
    },
    { name: "recordsProcessed", type: "number", defaultValue: 0 },
    { name: "recordsFailed", type: "number", defaultValue: 0 },
    { name: "recordsSkipped", type: "number", defaultValue: 0 },
    {
      name: "details",
      type: "json",
      admin: { description: "Sync summary: table, incremental watermark, warnings" },
    },
    {
      name: "errors",
      type: "array",
      fields: [
        { name: "message", type: "text" },
        { name: "recordId", type: "text" },
      ],
    },
    { name: "syncDurationMs", type: "number" },
    {
      name: "triggeredBy",
      type: "text",
      admin: { description: "User id or 'cron'" },
    },
    { name: "startedAt", type: "date" },
    { name: "completedAt", type: "date" },
  ],
};
