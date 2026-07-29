import type { CollectionConfig } from "payload";

export const AccountingConnections: CollectionConfig = {
  slug: "accounting-connections",
  admin: {
    useAsTitle: "organisationId",
    defaultColumns: ["organisationId", "provider", "status", "lastSyncAt", "createdAt"],
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
        collection: "accounting-connections",
        id: String(id),
      });
      return { organisationId: { equals: doc?.organisationId } };
    },
    delete: async ({ req, id }) => {
      if (!req.user || !id) return false;
      const doc = await req.payload.findByID({
        collection: "accounting-connections",
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
      name: "provider",
      type: "select",
      required: true,
      options: [
        { label: "Xero", value: "xero" },
        { label: "QuickBooks Online", value: "quickbooks" },
      ],
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
      name: "providerId",
      type: "text",
      required: true,
      admin: { description: "Xero Tenant ID or QB Realm ID" },
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
      name: "expenseCategoryMapping",
      type: "json",
      admin: {
        description:
          "Maps expense categories to GL codes for emissions calculation, e.g., { travel: 6200, utilities: 6100 }",
      },
    },
    {
      name: "syncConfig",
      type: "group",
      fields: [
        {
          name: "enableExpenseSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync expense data" },
        },
        {
          name: "enableBankFeedSync",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Sync bank feeds for utility bills (Xero only)" },
        },
        {
          name: "enableAutoCateg",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Auto-categorize expenses by GL code" },
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
