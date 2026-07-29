import type { CollectionConfig } from "payload";

export const PowerBIConnections: CollectionConfig = {
  slug: "powerbi-connections",
  admin: {
    useAsTitle: "organisationId",
    defaultColumns: ["organisationId", "workspaceName", "lastSyncAt", "createdAt"],
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
      name: "workspaceName",
      type: "text",
      required: true,
      admin: { description: "Power BI workspace display name" },
    },
    {
      name: "config",
      type: "json",
      required: true,
      admin: {
        description:
          "Power BI configuration: tenantId, clientId, clientSecret, workspaceId, reportId, refreshSchedule",
      },
    },
    {
      name: "accessToken",
      type: "text",
      admin: { description: "OAuth access token", readOnly: true },
    },
    {
      name: "refreshToken",
      type: "text",
      admin: { description: "OAuth refresh token", readOnly: true },
    },
    {
      name: "expiresAt",
      type: "date",
      admin: { description: "Token expiration time" },
    },
    {
      name: "datasetMappings",
      type: "array",
      fields: [
        {
          name: "sourceTable",
          type: "text",
          required: true,
          admin: { description: "ClearESG collection name" },
        },
        {
          name: "sourceFields",
          type: "array",
          fields: [
            {
              name: "field",
              type: "text",
            },
          ],
        },
        {
          name: "targetDataset",
          type: "text",
          required: true,
          admin: { description: "Power BI dataset name" },
        },
        {
          name: "targetFields",
          type: "array",
          fields: [
            {
              name: "field",
              type: "text",
            },
          ],
        },
        {
          name: "refreshSchedule",
          type: "select",
          options: [
            { label: "Manual", value: "manual" },
            { label: "Hourly", value: "hourly" },
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
          ],
          defaultValue: "daily",
        },
      ],
      admin: { description: "Data source mappings for Power BI datasets" },
    },
    {
      name: "syncConfig",
      type: "group",
      fields: [
        {
          name: "enableLiveDataRefresh",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Enable automatic refresh of datasets" },
        },
        {
          name: "enableMetricsCalculation",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Calculate metrics in Power BI" },
        },
        {
          name: "embedReports",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Enable embedded reports in ClearESG" },
        },
      ],
    },
    {
      name: "refreshSchedule",
      type: "json",
      admin: { description: "Scheduled refresh time and days" },
    },
    { name: "lastSyncAt", type: "date", admin: { readOnly: true } },
    { name: "lastSyncStatus", type: "text", admin: { readOnly: true } },
    {
      name: "lastSyncRecords",
      type: "number",
      admin: { readOnly: true },
    },
    { name: "connectedAt", type: "date", admin: { readOnly: true } },
  ],
};
