import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const BI_API_KEYS_SLUG = "bi-api-keys" as const;

export const BiApiKeys: CollectionConfig = {
  slug: BI_API_KEYS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "apiKeyPrefix", "status", "lastUsedAt", "createdAt"],
    description: "Organisation API keys for read-only BI connectors (Power BI, Tableau)",
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
      admin: { description: "Label shown in settings (e.g. Power BI production)" },
    },
    {
      name: "apiKeyHash",
      type: "text",
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description: "SHA-256 of API key (never store plaintext)",
      },
    },
    {
      name: "apiKeyPrefix",
      type: "text",
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description: "First characters of API key for identification",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
      ],
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "Membership user who created the key" },
    },
    {
      name: "lastUsedAt",
      type: "date",
      admin: { description: "Last successful BI API request" },
    },
    {
      name: "revokedAt",
      type: "date",
      admin: { description: "When the key was revoked" },
    },
    {
      name: "quotaLimitPerHour",
      type: "number",
      min: 0,
      admin: {
        description:
          "Optional per-key hour override. Empty uses plan default (free 10 / pro 500 / consultant unlimited).",
      },
    },
    {
      name: "quotaLimitPerDay",
      type: "number",
      min: 0,
      admin: {
        description:
          "Optional per-key day override. Empty uses plan default (free 100 / pro 10_000 / consultant unlimited).",
      },
    },
    {
      name: "quotaResetAt",
      type: "date",
      admin: {
        description: "Next UTC day boundary when daily usage counters reset for display",
        readOnly: true,
      },
    },
    {
      name: "callsThisHour",
      type: "number",
      defaultValue: 0,
      min: 0,
      admin: {
        description: "Approximate calls in the current UTC hour (settings display)",
        readOnly: true,
      },
    },
    {
      name: "callsToday",
      type: "number",
      defaultValue: 0,
      min: 0,
      admin: {
        description: "Approximate calls since last UTC day reset (settings display)",
        readOnly: true,
      },
    },
    {
      name: "quotaWarningSentAt",
      type: "date",
      admin: {
        description: "When the approaching-limit notification was last sent",
        readOnly: true,
      },
    },
    {
      name: "allowedIps",
      type: "array",
      admin: {
        description: "Optional IP whitelist. Empty = all IPs allowed.",
      },
      fields: [
        {
          name: "ip",
          type: "text",
          required: true,
          admin: { description: "Client IP (exact match)" },
        },
      ],
    },
  ],
};
