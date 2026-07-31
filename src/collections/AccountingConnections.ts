import type { CollectionConfig } from "payload";

import { accessibleOrgIds } from "@/lib/access/membership";

export const ACCOUNTING_CONNECTIONS_SLUG = "accounting-connections" as const;

export const AccountingConnections: CollectionConfig = {
  slug: ACCOUNTING_CONNECTIONS_SLUG,
  admin: {
    useAsTitle: "companyName",
    defaultColumns: [
      "provider",
      "companyName",
      "status",
      "connectionMode",
      "lastSyncAt",
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
    update: async ({ req }) => {
      if (!req.user) return false;
      const ids = await accessibleOrgIds(req);
      if (ids.length === 0) return false;
      return { organisationId: { in: ids } };
    },
    delete: async ({ req }) => {
      if (!req.user) return false;
      const ids = await accessibleOrgIds(req);
      if (ids.length === 0) return false;
      return { organisationId: { in: ids } };
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
        { label: "Wave", value: "wave" },
      ],
      index: true,
    },
    {
      name: "connectionMode",
      type: "select",
      defaultValue: "sandbox",
      options: [
        { label: "Sandbox / mock", value: "sandbox" },
        { label: "Live OAuth", value: "live" },
      ],
      admin: {
        description:
          "Sandbox uses encrypted mock tokens when OAuth client secrets are not configured",
      },
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
      name: "companyName",
      type: "text",
      admin: { description: "Company / tenant name from the accounting provider" },
    },
    {
      name: "providerId",
      type: "text",
      required: true,
      defaultValue: "pending",
      admin: {
        description: "Xero Tenant ID, QuickBooks Realm ID, or Wave business ID",
      },
    },
    {
      name: "accessToken",
      type: "text",
      admin: {
        description: "OAuth access token (AES-256-GCM encrypted at rest)",
        readOnly: true,
      },
    },
    {
      name: "refreshToken",
      type: "text",
      admin: {
        description: "OAuth refresh token (AES-256-GCM encrypted at rest)",
        readOnly: true,
      },
    },
    {
      name: "expiresAt",
      type: "date",
      admin: { description: "Access token expiration" },
    },
    {
      name: "expenseCategoryMapping",
      type: "json",
      admin: {
        description:
          'Account code/name → { category, scope }. Example: { "6110": { "category": "fuel_energy", "scope": "1" } }',
      },
    },
    {
      name: "discoveredAccounts",
      type: "json",
      admin: {
        description: "Chart of accounts discovered on last sync (code, name)",
        readOnly: true,
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
          admin: { description: "Sync expense / bill spend" },
        },
        {
          name: "enableBankFeedSync",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Sync bank feeds for utility bills (Xero)" },
        },
        {
          name: "enableAutoCateg",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Auto-categorize by account name / GL code" },
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
    { name: "nextSyncAt", type: "date", admin: { readOnly: true } },
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
