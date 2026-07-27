import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

/**
 * Intra-org data collection — generalises the supplier request-status pattern
 * for Membership users (not public tokens). §18.1.1
 */
export const InternalDataRequests: CollectionConfig = {
  slug: "internal-data-requests",
  admin: {
    defaultColumns: ["title", "organisation", "assignee", "requestStatus", "dueDate"],
    useAsTitle: "title",
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
    {
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
    },
    { name: "title", type: "text", required: true },
    {
      name: "assignee",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "metricKeys",
      type: "array",
      required: true,
      minRows: 1,
      fields: [{ name: "key", type: "text", required: true }],
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
      ],
    },
    { name: "dueDate", type: "date", index: true },
    { name: "sentAt", type: "date" },
    { name: "openedAt", type: "date" },
    { name: "submittedAt", type: "date" },
    { name: "lastReminderAt", type: "date" },
    { name: "reminderCount", type: "number", defaultValue: 0, min: 0 },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
};
