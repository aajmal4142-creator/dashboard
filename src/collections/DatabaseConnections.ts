import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const DATABASE_CONNECTIONS_SLUG = "database-connections" as const;

export const DatabaseConnections: CollectionConfig = {
  slug: DATABASE_CONNECTIONS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "engine", "status", "syncFrequency", "lastSyncAt"],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "name",
      type: "text",
      required: true,
      admin: { description: "Human-readable connection label" },
    },
    {
      name: "engine",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "PostgreSQL", value: "postgresql" },
        { label: "MySQL", value: "mysql" },
        { label: "Google BigQuery", value: "bigquery" },
        { label: "Snowflake", value: "snowflake" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Connected", value: "connected" },
        { label: "Failed", value: "failed" },
        { label: "Disabled", value: "disabled" },
      ],
    },
    {
      name: "encryptedCredentials",
      type: "textarea",
      required: true,
      admin: {
        readOnly: true,
        description: "AES-256-GCM ciphertext. Never log or return to clients.",
      },
    },
    {
      name: "sslEnabled",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Require SSL/TLS for PostgreSQL and MySQL" },
    },
    {
      name: "displayHost",
      type: "text",
      admin: { description: "Host or GCP project id (non-secret, for UI)" },
    },
    {
      name: "displayDatabase",
      type: "text",
      admin: { description: "Database name or BigQuery dataset (non-secret)" },
    },
    {
      name: "sourceSchema",
      type: "text",
      admin: { description: "Schema / dataset namespace for table discovery" },
    },
    {
      name: "sourceTable",
      type: "text",
      admin: { description: "Mapped source table for sync" },
    },
    {
      name: "fieldMappings",
      type: "json",
      admin: {
        description:
          "Column → datapoint field map plus optional defaults (metricKey, quality, unit)",
      },
    },
    {
      name: "incrementalColumn",
      type: "text",
      admin: {
        description:
          "Column for incremental sync (timestamp or monotonic id). Empty = full reload.",
      },
    },
    {
      name: "lastIncrementalValue",
      type: "text",
      admin: { readOnly: true, description: "High-water mark from last successful sync" },
    },
    {
      name: "defaultPeriod",
      type: "relationship",
      relationTo: "reporting-periods",
      admin: { description: "Reporting period for synced datapoints" },
    },
    {
      name: "syncFrequency",
      type: "select",
      required: true,
      defaultValue: "manual",
      options: [
        { label: "Manual only", value: "manual" },
        { label: "Hourly", value: "hourly" },
        { label: "Daily", value: "daily" },
        { label: "Weekly", value: "weekly" },
      ],
    },
    {
      name: "nextSyncAt",
      type: "date",
      admin: { readOnly: true },
      index: true,
    },
    {
      name: "lastSyncAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "lastSyncStatus",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "testedAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "lastError",
      type: "textarea",
      admin: { readOnly: true, description: "Last actionable error (no secrets)" },
    },
  ],
};
