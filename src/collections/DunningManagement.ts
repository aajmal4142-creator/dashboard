import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const DUNNING_MANAGEMENT_SLUG = "dunning-management" as const;

export const DunningManagement: CollectionConfig = {
  slug: DUNNING_MANAGEMENT_SLUG,
  admin: {
    useAsTitle: "subscription",
    defaultColumns: [
      "subscription",
      "status",
      "failureReason",
      "retryAttempts",
      "lastRetryAt",
    ],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "subscription",
      type: "relationship",
      relationTo: "subscriptions",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Retrying", value: "retrying" },
        { label: "Failed", value: "failed" },
        { label: "Resolved", value: "resolved" },
        { label: "Suspended", value: "suspended" },
        { label: "Canceled", value: "canceled" },
      ],
      defaultValue: "active",
      index: true,
    },
    {
      name: "failureReason",
      type: "text",
      admin: { description: "Stripe error message from failed payment" },
    },
    {
      name: "failureCode",
      type: "select",
      options: [
        { label: "Insufficient Funds", value: "insufficient_funds" },
        { label: "Lost Card", value: "lost_card" },
        { label: "Stolen Card", value: "stolen_card" },
        { label: "Expired Card", value: "expired_card" },
        { label: "Incorrect CVC", value: "incorrect_cvc" },
        { label: "Processor Error", value: "processor_error" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "initialFailureDate",
      type: "date",
      required: true,
      admin: { description: "When first payment failure occurred" },
    },
    {
      name: "retrySchedule",
      type: "select",
      defaultValue: "stripe_default",
      options: [
        { label: "Stripe Default (3 retries)", value: "stripe_default" },
        { label: "Aggressive (1,3,5 days)", value: "aggressive" },
        { label: "Conservative (7,14 days)", value: "conservative" },
        { label: "Custom", value: "custom" },
      ],
    },
    {
      name: "customRetryDays",
      type: "array",
      admin: { description: "Custom retry schedule (days after initial failure)" },
      fields: [
        {
          name: "dayOffset",
          type: "number",
          required: true,
        },
      ],
    },
    {
      name: "retryAttempts",
      type: "array",
      fields: [
        {
          name: "attemptNumber",
          type: "number",
          required: true,
        },
        {
          name: "attemptedAt",
          type: "date",
          required: true,
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "Success", value: "success" },
            { label: "Failed", value: "failed" },
            { label: "Pending", value: "pending" },
          ],
          required: true,
        },
        {
          name: "errorMessage",
          type: "text",
        },
        {
          name: "paymentIntentId",
          type: "text",
          admin: { description: "Stripe PaymentIntent ID" },
        },
      ],
    },
    {
      name: "lastRetryAt",
      type: "date",
      admin: { description: "Date of last retry attempt" },
    },
    {
      name: "nextRetryAt",
      type: "date",
      admin: { description: "Scheduled next retry (null if none)" },
    },
    {
      name: "dunningEmailsSent",
      type: "array",
      admin: { description: "Track dunning communication sent to customer" },
      fields: [
        {
          name: "emailType",
          type: "select",
          required: true,
          options: [
            { label: "Payment Failed", value: "payment_failed" },
            { label: "Retry Scheduled", value: "retry_scheduled" },
            { label: "Final Notice", value: "final_notice" },
            { label: "Account Suspended", value: "account_suspended" },
            { label: "Manual Payment Link", value: "manual_link" },
          ],
        },
        {
          name: "sentAt",
          type: "date",
          required: true,
        },
        {
          name: "sentTo",
          type: "email",
          required: true,
        },
        {
          name: "opened",
          type: "checkbox",
        },
        {
          name: "clicked",
          type: "checkbox",
        },
      ],
    },
    {
      name: "manualPaymentLink",
      type: "text",
      admin: { description: "Manual payment link sent to customer" },
    },
    {
      name: "manualPaymentAttempts",
      type: "number",
      defaultValue: 0,
      admin: { description: "Number of times customer accessed manual payment link" },
    },
    {
      name: "accountSuspendedAt",
      type: "date",
      admin: { description: "When account was suspended due to payment failure" },
    },
    {
      name: "recoveryDate",
      type: "date",
      admin: { description: "When account was recovered (payment successful)" },
    },
    {
      name: "canceledAt",
      type: "date",
      admin: { description: "When subscription was canceled due to payment failure" },
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Manual notes about this dunning case" },
    },
  ],
};
