import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SUBSCRIPTIONS_SLUG = "subscriptions" as const;

export const Subscriptions: CollectionConfig = {
  slug: SUBSCRIPTIONS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "organisation",
      "plan",
      "status",
      "billingCycle",
      "currentPeriodStart",
      "currentPeriodEnd",
    ],
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
      admin: { description: "Organization subscribed to this plan" },
    },
    {
      name: "plan",
      type: "relationship",
      relationTo: "plans",
      required: true,
      index: true,
      admin: { description: "Selected plan" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Trialing", value: "trialing" },
        { label: "Past Due", value: "past_due" },
        { label: "Canceled", value: "canceled" },
        { label: "Suspended", value: "suspended" },
      ],
      defaultValue: "trialing",
      index: true,
    },
    {
      name: "billingCycle",
      type: "select",
      required: true,
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
      defaultValue: "monthly",
    },
    {
      name: "currentPeriodStart",
      type: "date",
      required: true,
      admin: { description: "Start of current billing period" },
    },
    {
      name: "currentPeriodEnd",
      type: "date",
      required: true,
      admin: { description: "End of current billing period" },
    },
    {
      name: "trialEndsAt",
      type: "date",
      admin: { description: "Trial expiration (null if not in trial)" },
    },
    {
      name: "cancelledAt",
      type: "date",
      admin: { description: "Cancellation timestamp" },
    },
    {
      name: "stripeSubscriptionId",
      type: "text",
      unique: true,
      admin: { description: "Stripe subscription ID for sync" },
    },
    {
      name: "stripeCustomerId",
      type: "text",
      admin: { description: "Stripe customer ID" },
    },
    {
      name: "seats",
      type: "number",
      required: true,
      defaultValue: 1,
      min: 1,
      admin: { description: "Number of paid seats" },
    },
    {
      name: "autoRenew",
      type: "checkbox",
      required: true,
      defaultValue: true,
      admin: { description: "Auto-renew on period end" },
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
      admin: { readOnly: true },
    },
    {
      name: "updatedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
      admin: { readOnly: true },
    },
    {
      name: "sendInvoices",
      type: "checkbox",
      required: true,
      defaultValue: true,
      admin: { description: "Send invoice emails when generated" },
    },
    {
      name: "contactEmail",
      type: "email",
      admin: {
        description: "Email address for billing notifications (defaults to org email)",
      },
    },
    {
      name: "sendUsageAlerts",
      type: "checkbox",
      required: true,
      defaultValue: true,
      admin: { description: "Send email alerts when usage reaches 80% of quota" },
    },
    {
      name: "nextRenewalDate",
      type: "date",
      required: true,
      index: true,
      admin: { description: "Next renewal/billing date" },
    },
    {
      name: "lastRenewalDate",
      type: "date",
      admin: { readOnly: true, description: "Last renewal date" },
    },
    {
      name: "annualDiscountPercentage",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: { description: "Discount percentage applied (only for annual billing)" },
    },
    {
      name: "contractTermYears",
      type: "select",
      options: [
        { label: "1 year", value: "1" },
        { label: "2 years", value: "2" },
        { label: "3 years", value: "3" },
      ],
      admin: {
        description:
          "Multi-year commercial term (1–3). Null = month-to-month / annual only.",
      },
    },
    {
      name: "contractEndsAt",
      type: "date",
      admin: { description: "End of the multi-year contract window" },
    },
    {
      name: "multiYearDiscountPercent",
      type: "number",
      min: 0,
      max: 100,
      admin: {
        description:
          "Additional discount % for 2–3 year terms (commercial, not Stripe coupon)",
      },
    },
    {
      name: "trialExtensionCount",
      type: "number",
      min: 0,
      max: 10,
      defaultValue: 0,
      admin: {
        description: "How many times the trial has been extended (max 2 via self-serve)",
        readOnly: true,
      },
    },
  ],
};
