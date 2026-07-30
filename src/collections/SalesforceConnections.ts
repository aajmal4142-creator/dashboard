import type { CollectionConfig } from "payload";

export const SalesforceConnections: CollectionConfig = {
  slug: "salesforce-connections",
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
        collection: "salesforce-connections",
        id: String(id),
      });
      return { organisationId: { equals: doc?.organisationId } };
    },
    delete: async ({ req, id }) => {
      if (!req.user || !id) return false;
      const doc = await req.payload.findByID({
        collection: "salesforce-connections",
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
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "pending",
      index: true,
    },
    {
      name: "instanceUrl",
      type: "text",
      admin: { description: "Salesforce instance URL" },
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
      name: "accountMapping",
      type: "json",
      admin: {
        description:
          "Maps Salesforce Account IDs to ClearESG organisation IDs, e.g., { salesforceAccountId: organisationId }",
      },
    },
    {
      name: "syncConfig",
      type: "group",
      fields: [
        {
          name: "enableAccountSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync Salesforce Accounts as supplier orgs" },
        },
        {
          name: "enableContactSync",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Sync contact data to ClearESG teams" },
        },
        {
          name: "enableMetricsWrite",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Write ESG metrics back to Salesforce records" },
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
