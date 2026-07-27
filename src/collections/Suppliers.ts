import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const Suppliers: CollectionConfig = {
  slug: "suppliers",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "organisation", "requestStatus", "annualSpend"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    { name: "name", type: "text", required: true },
    { name: "contactEmail", type: "email", required: true },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Purchased goods", value: "purchased_goods" },
        { label: "Capital goods", value: "capital_goods" },
        { label: "Transport", value: "transport" },
        { label: "Waste", value: "waste" },
        { label: "Business travel", value: "business_travel" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "annualSpend", type: "number", min: 0 },
    {
      name: "requestPeriod",
      type: "relationship",
      relationTo: "reporting-periods",
      admin: {
        description: "Reporting period this request token is bound to",
      },
    },
    {
      name: "requestToken",
      type: "text",
      unique: true,
      index: true,
    },
    {
      name: "requestStatus",
      type: "select",
      defaultValue: "not_sent",
      options: [
        { label: "Not sent", value: "not_sent" },
        { label: "Sent", value: "sent" },
        { label: "Opened", value: "opened" },
        { label: "Submitted", value: "submitted" },
        { label: "Declined", value: "declined" },
      ],
    },
    { name: "sentAt", type: "date" },
    { name: "requestExpiresAt", type: "date" },
    { name: "respondedAt", type: "date" },
    { name: "lastReminderAt", type: "date" },
    { name: "submittedData", type: "json" },
    { name: "reminderCount", type: "number", defaultValue: 0, min: 0 },
  ],
};
