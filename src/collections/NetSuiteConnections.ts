import type { CollectionConfig } from "payload";

export const NetSuiteConnections: CollectionConfig = {
  slug: "netsuite-connections",
  admin: {
    useAsTitle: "organisationId",
    defaultColumns: ["organisationId", "status", "lastSyncAt", "createdAt"],
  },
  access: {
    read: async ({ req, id }) => {
      if (!req.user) return false;
      if (!id) return false;
      return { organisationId: { equals: req.user.id } };
    },
    create: async ({ req }) => req.user !== null,
    update: async ({ req, id }) => {
      if (!req.user || !id) return false;
      const doc = await req.payload.findByID({
        collection: "netsuite-connections",
        id: String(id),
      });
      return { organisationId: { equals: doc?.organisationId } };
    },
    delete: async ({ req, id }) => {
      if (!req.user || !id) return false;
      const doc = await req.payload.findByID({
        collection: "netsuite-connections",
        id: String(id),
      });
      return { organisationId: { equals: doc?.organisationId } };
    },
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
      name: "accountId",
      type: "text",
      required: true,
      admin: { description: "NetSuite Account ID" },
    },
    {
      name: "consumerKey",
      type: "text",
      admin: { description: "OAuth consumer key", readOnly: true },
    },
    {
      name: "consumerSecret",
      type: "text",
      admin: { description: "OAuth consumer secret", readOnly: true },
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
      name: "accessTokenSecret",
      type: "text",
      admin: { description: "OAuth token secret (TBA)", readOnly: true },
    },
    { name: "expiresAt", type: "date", admin: { description: "Token expiration time" } },
    {
      name: "glCodeMapping",
      type: "json",
      admin: {
        description:
          'Maps GL codes to emissions categories, e.g., { "6000": "electricity", "6100": "gas" }',
      },
    },
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
          name: "enableInvoiceSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync invoices and POs" },
        },
        {
          name: "enableSpendCalculation",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Calculate spend-based emissions" },
        },
        {
          name: "syncFrequency",
          type: "select",
          options: [
            { label: "Manual only", value: "manual" },
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
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
