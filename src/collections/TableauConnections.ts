import type { CollectionConfig } from "payload";

export const TableauConnections: CollectionConfig = {
  slug: "tableau-connections",
  admin: {
    useAsTitle: "organisationId",
    defaultColumns: ["organisationId", "serverUrl", "lastSyncAt", "createdAt"],
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
      name: "serverUrl",
      type: "text",
      required: true,
      admin: { description: "Tableau Server or Online base URL" },
    },
    {
      name: "siteId",
      type: "text",
      required: true,
      admin: { description: "Tableau site/organization ID" },
    },
    {
      name: "config",
      type: "json",
      required: true,
      admin: {
        description:
          "Tableau configuration: serverUrl, siteId, accessToken, userId, contentUrl, rowLevelSecurity",
      },
    },
    {
      name: "accessToken",
      type: "text",
      admin: { description: "Personal access token", readOnly: true },
    },
    {
      name: "userId",
      type: "text",
      admin: { description: "Tableau user ID" },
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
          admin: { description: "Tableau datasource name" },
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
      admin: { description: "Data source mappings for Tableau" },
    },
    {
      name: "rowLevelSecurity",
      type: "group",
      fields: [
        {
          name: "enabled",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Enable row-level security" },
        },
        {
          name: "column",
          type: "text",
          admin: { description: "RLS column name" },
        },
        {
          name: "mapping",
          type: "json",
          admin: {
            description:
              'User-to-value mapping, e.g. {"user@org.com": ["value1", "value2"]}',
          },
        },
      ],
      admin: { description: "Row-level security configuration" },
    },
    {
      name: "syncConfig",
      type: "group",
      fields: [
        {
          name: "enableLiveConnection",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Use live connection instead of extract" },
        },
        {
          name: "enableRowLevelSecurity",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Apply RLS to workbooks" },
        },
        {
          name: "publishDashboards",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Auto-publish sample dashboards" },
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
