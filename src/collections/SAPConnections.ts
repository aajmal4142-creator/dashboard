import type { CollectionConfig } from "payload";

export const SAPConnections: CollectionConfig = {
  slug: "sap-connections",
  admin: {
    useAsTitle: "organisationId",
    defaultColumns: ["organisationId", "status", "lastSyncAt", "createdAt"],
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
      name: "status",
      type: "select",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Connected", value: "connected" },
        { label: "Failed", value: "failed" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "pending",
      index: true,
    },
    {
      name: "environmentType",
      type: "select",
      required: true,
      options: [
        { label: "Sandbox", value: "sandbox" },
        { label: "Production", value: "production" },
      ],
      admin: { description: "SAP environment type" },
    },
    {
      name: "systemId",
      type: "text",
      required: true,
      admin: { description: "SAP System ID (SID)" },
    },
    {
      name: "clientNumber",
      type: "text",
      required: true,
      admin: { description: "SAP client number" },
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
    { name: "expiresAt", type: "date", admin: { description: "Token expiration time" } },
    {
      name: "syncConfig",
      type: "group",
      fields: [
        {
          name: "enableGlSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync General Ledger balances" },
        },
        {
          name: "enableBomSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync Bill of Materials" },
        },
        {
          name: "enableProductionSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync production orders and data" },
        },
        {
          name: "trackingMaterials",
          type: "array",
          fields: [
            {
              name: "materialId",
              type: "text",
              required: true,
            },
            {
              name: "materialDescription",
              type: "text",
            },
          ],
          admin: { description: "Materials to track for emissions" },
        },
        {
          name: "syncFrequency",
          type: "select",
          options: [
            { label: "Manual only", value: "manual" },
            { label: "Hourly", value: "hourly" },
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
          ],
          defaultValue: "manual",
        },
      ],
    },
    { name: "lastSyncAt", type: "date", admin: { readOnly: true } },
    { name: "lastSyncStatus", type: "text", admin: { readOnly: true } },
    {
      name: "syncErrorCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
    { name: "connectedAt", type: "date", admin: { readOnly: true } },
  ],
};
