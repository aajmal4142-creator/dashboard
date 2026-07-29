import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const PLANS_SLUG = "plans" as const;

export const Plans: CollectionConfig = {
  slug: PLANS_SLUG,
  admin: {
    useAsTitle: "displayName",
    defaultColumns: [
      "name",
      "displayName",
      "monthlyPrice",
      "dataPointsPerMonth",
      "reportsPerMonth",
    ],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "name",
      type: "select",
      required: true,
      unique: true,
      options: [
        { label: "Starter", value: "starter" },
        { label: "Professional", value: "professional" },
        { label: "Enterprise", value: "enterprise" },
        { label: "Trial", value: "trial" },
      ],
      admin: { description: "Plan tier identifier" },
    },
    {
      name: "displayName",
      type: "text",
      required: true,
      admin: { description: "Display name for UI" },
    },
    {
      name: "monthlyPrice",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Price in USD per month" },
    },
    {
      name: "annualPrice",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Price in USD per year (annual discount applied)" },
    },
    {
      name: "dataPointsPerMonth",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Monthly datapoint limit (0 = unlimited)" },
    },
    {
      name: "reportsPerMonth",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Monthly report limit (0 = unlimited)" },
    },
    {
      name: "storageGB",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Storage limit in GB (0 = unlimited)" },
    },
    {
      name: "activeUsersLimit",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Active concurrent users limit (0 = unlimited)" },
    },
    {
      name: "features",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
        },
      ],
      admin: { description: "List of plan features" },
    },
    {
      name: "overageRatePerUnit",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Overage charge per 100 datapoints" },
    },
    {
      name: "trialDays",
      type: "number",
      min: 0,
      admin: { description: "Trial period in days (0 = no trial)" },
    },
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Active plans are selectable by users" },
    },
  ],
};
