import type { CollectionConfig } from "payload";

export const DataWarehouseConnections: CollectionConfig = {
  slug: "datawarehouse-connections",
  admin: {
    useAsTitle: "organisationId",
    defaultColumns: ["organisationId", "provider", "lastExportAt", "createdAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
      name: "provider",
      type: "select",
      required: true,
      options: [
        { label: "Snowflake", value: "snowflake" },
        { label: "Google BigQuery", value: "bigquery" },
        { label: "Databricks", value: "databricks" },
      ],
      index: true,
      admin: { description: "Data warehouse provider" },
    },
    {
      name: "config",
      type: "json",
      required: true,
      admin: {
        description:
          "Provider-specific configuration (Snowflake: account, warehouse, database, schema, role, username; BigQuery: projectId, datasetId, credentials; Databricks: instanceUrl, token, warehouseId, schemaName)",
      },
    },
    {
      name: "exportConfig",
      type: "group",
      fields: [
        {
          name: "tablePrefix",
          type: "text",
          required: true,
          defaultValue: "clearesg",
          admin: { description: "Prefix for exported tables" },
        },
        {
          name: "frequency",
          type: "select",
          options: [
            { label: "Manual only", value: "manual" },
            { label: "Hourly", value: "hourly" },
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
          ],
          defaultValue: "manual",
          admin: { description: "Automatic export frequency" },
        },
        {
          name: "incremental",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Only export changed records" },
        },
        {
          name: "transformations",
          type: "json",
          admin: { description: "Optional data transformations" },
        },
      ],
    },
    {
      name: "testConnection",
      type: "checkbox",
      admin: {
        readOnly: true,
        description: "Run test query to verify connection",
      },
    },
    { name: "lastExportAt", type: "date", admin: { readOnly: true } },
    { name: "lastExportStatus", type: "text", admin: { readOnly: true } },
    {
      name: "lastExportRecords",
      type: "number",
      admin: { readOnly: true },
    },
    { name: "connectedAt", type: "date", admin: { readOnly: true } },
  ],
};
