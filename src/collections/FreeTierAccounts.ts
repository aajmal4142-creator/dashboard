import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const FREE_TIER_ACCOUNTS_SLUG = "free-tier-accounts" as const;

export const FreeTierAccounts: CollectionConfig = {
  slug: FREE_TIER_ACCOUNTS_SLUG,
  admin: {
    useAsTitle: "organisation",
    defaultColumns: ["organisation", "status", "createdAt", "upgradedAt"],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Organization on free tier" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Upgraded", value: "upgraded" },
        { label: "Suspended", value: "suspended" },
      ],
      defaultValue: "active",
      index: true,
    },
    {
      name: "dataPointsUsed",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { description: "Current month datapoints used" },
    },
    {
      name: "reportsGenerated",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { description: "Current month reports generated" },
    },
    {
      name: "apiCallsUsed",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { description: "Current month API calls" },
    },
    {
      name: "limitReachedNotificationSent",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Whether limit approaching notification was sent" },
    },
    {
      name: "upgradedAt",
      type: "date",
      admin: { description: "Date when account was upgraded from free tier" },
    },
    {
      name: "conversionValue",
      type: "number",
      admin: { description: "MRR value at conversion (if upgraded)" },
    },
    {
      name: "lastResetDate",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { description: "Last date usage counters were reset" },
    },
  ],
};
