import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SUBSCRIPTION_HISTORY_SLUG = "subscription-history" as const;

export const SubscriptionHistory: CollectionConfig = {
  slug: SUBSCRIPTION_HISTORY_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "subscription",
      "organisation",
      "action",
      "prorataAdjustment",
      "timestamp",
    ],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "subscription",
      type: "relationship",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relationTo: "subscriptions" as any,
      required: true,
      index: true,
      admin: { description: "Associated subscription" },
    },
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: { description: "Organization for quick filtering" },
    },
    {
      name: "action",
      type: "select",
      required: true,
      options: [
        { label: "Upgrade", value: "upgrade" },
        { label: "Downgrade", value: "downgrade" },
        { label: "Billing Cycle Change", value: "billing_cycle_change" },
        { label: "Renewal", value: "renewal" },
        { label: "Cancellation", value: "cancellation" },
      ],
      index: true,
      admin: { description: "Type of subscription change" },
    },
    {
      name: "previousPlan",
      type: "relationship",
      relationTo: "plans",
      admin: { description: "Plan before change (if applicable)" },
    },
    {
      name: "newPlan",
      type: "relationship",
      relationTo: "plans",
      admin: { description: "Plan after change (if applicable)" },
    },
    {
      name: "previousCycle",
      type: "select",
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
      admin: { description: "Billing cycle before change" },
    },
    {
      name: "newCycle",
      type: "select",
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
      admin: { description: "Billing cycle after change" },
    },
    {
      name: "prorataAdjustment",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { description: "Pro-rata credit (positive) or charge (negative)" },
    },
    {
      name: "timestamp",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
      admin: { readOnly: true, description: "When change occurred" },
    },
    {
      name: "initiatedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who triggered this change" },
    },
    {
      name: "metadata",
      type: "textarea",
      admin: { description: "JSON metadata (Stripe IDs, notes, etc.)" },
    },
  ],
};
