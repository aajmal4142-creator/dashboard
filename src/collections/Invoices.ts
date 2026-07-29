import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const INVOICES_SLUG = "invoices" as const;

export const Invoices: CollectionConfig = {
  slug: INVOICES_SLUG,
  admin: {
    useAsTitle: "invoiceNumber",
    defaultColumns: [
      "invoiceNumber",
      "organisation",
      "status",
      "amount",
      "issueDate",
      "dueDate",
    ],
  },
  access: tenantAccess({ writeMin: "contributor" }),
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
      name: "invoiceNumber",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Human-readable invoice number" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Paid", value: "paid" },
        { label: "Overdue", value: "overdue" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "draft",
      index: true,
    },
    {
      name: "periodStart",
      type: "date",
      required: true,
      admin: { description: "Billing period start" },
    },
    {
      name: "periodEnd",
      type: "date",
      required: true,
      admin: { description: "Billing period end" },
    },
    {
      name: "issueDate",
      type: "date",
      required: true,
      admin: { description: "Invoice issue date" },
    },
    {
      name: "dueDate",
      type: "date",
      required: true,
      admin: { description: "Payment due date" },
    },
    {
      name: "paidDate",
      type: "date",
      admin: { description: "Payment received date" },
    },
    {
      name: "amount",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Total invoice amount (USD)" },
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
      name: "lineItems",
      type: "array",
      required: true,
      fields: [
        {
          name: "description",
          type: "text",
          required: true,
        },
        {
          name: "quantity",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "unitPrice",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "amount",
          type: "number",
          required: true,
          min: 0,
        },
      ],
      admin: { description: "Line items (plan, seats, etc.)" },
    },
    {
      name: "overageCharges",
      type: "array",
      fields: [
        {
          name: "metric",
          type: "text",
          required: true,
        },
        {
          name: "units",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "unitPrice",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "amount",
          type: "number",
          required: true,
          min: 0,
        },
      ],
      admin: { description: "Overage charges beyond plan limits" },
    },
    {
      name: "taxes",
      type: "number",
      min: 0,
      admin: { description: "Tax amount" },
    },
    {
      name: "discount",
      type: "number",
      min: 0,
      admin: { description: "Discount amount" },
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Internal notes" },
    },
    {
      name: "stripeInvoiceId",
      type: "text",
      unique: true,
      admin: { description: "Stripe invoice ID" },
    },
    {
      name: "pdfUrl",
      type: "text",
      admin: { description: "URL to PDF invoice" },
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
