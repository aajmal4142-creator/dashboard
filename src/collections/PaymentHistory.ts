import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const PAYMENT_HISTORY_SLUG = "payment-history" as const;

export const PaymentHistory: CollectionConfig = {
  slug: PAYMENT_HISTORY_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "subscription",
      "organisation",
      "status",
      "amount",
      "paymentMethod",
      "paidAt",
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
      name: "invoice",
      type: "relationship",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relationTo: "invoices" as any,
      admin: { description: "Associated invoice" },
    },
    {
      name: "amount",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Payment amount (USD)" },
    },
    {
      name: "currency",
      type: "select",
      required: true,
      defaultValue: "USD",
      options: [{ label: "USD", value: "USD" }],
      admin: { readOnly: true },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Success", value: "success" },
        { label: "Pending", value: "pending" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "pending",
      index: true,
    },
    {
      name: "paymentMethod",
      type: "select",
      required: true,
      options: [
        { label: "Stripe", value: "stripe" },
        { label: "Wire Transfer", value: "wire" },
        { label: "Check", value: "check" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "transactionId",
      type: "text",
      unique: true,
      admin: { description: "Internal transaction ID" },
    },
    {
      name: "stripeChargeId",
      type: "text",
      unique: true,
      admin: { description: "Stripe charge ID" },
    },
    {
      name: "paidAt",
      type: "date",
      required: true,
      admin: { description: "Payment timestamp" },
    },
    {
      name: "failureReason",
      type: "textarea",
      admin: { description: "Reason for failed payment" },
    },
    {
      name: "refundReason",
      type: "textarea",
      admin: { description: "Reason for refund" },
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
      admin: { readOnly: true },
    },
  ],
};
