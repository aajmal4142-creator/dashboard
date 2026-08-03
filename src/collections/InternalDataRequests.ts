import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

/**
 * Intra-org data collection — generalises the supplier request-status pattern
 * for Membership users (not public tokens). §18.1.1 / Sprint 5 F14.
 */
export const InternalDataRequests: CollectionConfig = {
  slug: "internal-data-requests",
  admin: {
    defaultColumns: [
      "title",
      "organisation",
      "assignee",
      "requestStatus",
      "reviewStatus",
      "dueDate",
    ],
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
      admin: {
        description: "Multi-metric pack — one or more metric keys to collect.",
      },
      fields: [{ name: "key", type: "text", required: true }],
    },
    {
      name: "requestStatus",
      type: "select",
      defaultValue: "not_sent",
      index: true,
      options: [
        { label: "Not sent", value: "not_sent" },
        { label: "Sent", value: "sent" },
        { label: "Opened", value: "opened" },
        { label: "Submitted", value: "submitted" },
      ],
    },
    {
      name: "reviewStatus",
      type: "select",
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ],
      admin: {
        description:
          "Approve-after-submit workflow. Independent of datapoint approvalState (F13).",
      },
    },
    {
      name: "reviewerNotes",
      type: "textarea",
      admin: { description: "Notes from the reviewer on approve/reject." },
    },
    {
      name: "reviewedBy",
      type: "relationship",
      relationTo: "users",
    },
    { name: "reviewedAt", type: "date" },
    {
      name: "dueDate",
      type: "date",
      index: true,
      admin: {
        description: "SLA due date (API also exposes as dueAt).",
      },
    },
    { name: "sentAt", type: "date" },
    { name: "openedAt", type: "date" },
    { name: "submittedAt", type: "date" },
    {
      name: "escalatedAt",
      type: "date",
      index: true,
      admin: { description: "Set when overdue escalation fires." },
    },
    { name: "lastReminderAt", type: "date" },
    { name: "reminderCount", type: "number", defaultValue: 0, min: 0 },
    {
      name: "evidence",
      type: "relationship",
      relationTo: "evidence",
      hasMany: true,
      admin: {
        description: "Evidence attachments linked on submit.",
      },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
};
