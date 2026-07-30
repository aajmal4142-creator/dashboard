import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

/**
 * Per-org regulatory deadlines with status tracking.
 * Source of truth for compliance calendar and deadline alerts.
 */
export const RegulatoryDeadlines: CollectionConfig = {
  slug: "regulatory-deadlines",
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "organisation",
      "name",
      "jurisdiction",
      "framework",
      "dueDate",
      "status",
      "notificationsSent",
    ],
  },
  access: tenantAccess({ writeMin: "admin", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "name",
      type: "text",
      required: true,
      admin: { description: "e.g., CSRD Annual Report Filing, BRSR Submission" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Optional context or notes about this deadline" },
    },
    {
      name: "jurisdiction",
      type: "select",
      required: true,
      options: [
        { label: "EU", value: "EU" },
        { label: "India", value: "IN" },
        { label: "UK", value: "GB" },
        { label: "US", value: "US" },
        { label: "Global", value: "GLOBAL" },
        { label: "Other", value: "OTHER" },
      ],
      admin: { description: "ISO country/region code or scope" },
    },
    {
      name: "framework",
      type: "select",
      required: true,
      options: [
        { label: "CSRD", value: "CSRD" },
        { label: "BRSR", value: "BRSR" },
        { label: "GRI", value: "GRI" },
        { label: "SASB", value: "SASB" },
        { label: "TCFD", value: "TCFD" },
        { label: "ISO 14064", value: "ISO14064" },
        { label: "Other", value: "OTHER" },
      ],
    },
    {
      name: "dueDate",
      type: "date",
      required: true,
      admin: {
        description: "Deadline date for this obligation",
        date: { pickerAppearance: "dayOnly" },
      },
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Submitted", value: "submitted" },
        { label: "Verified", value: "verified" },
        { label: "Overdue", value: "overdue" },
      ],
      admin: { description: "Current status of the deadline" },
      index: true,
    },
    {
      name: "linkedReport",
      type: "relationship",
      relationTo: "reports",
      admin: {
        description: "Auto-linked report when status changes to submitted",
      },
    },
    {
      name: "completedDate",
      type: "date",
      admin: {
        description: "Date when work on this deadline was completed",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "submittedDate",
      type: "date",
      admin: {
        description: "Date when deadline was officially submitted",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "verifiedDate",
      type: "date",
      admin: {
        description: "Date when deadline was verified/approved",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "verifiedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who verified the deadline completion" },
    },
    {
      name: "colour",
      type: "select",
      defaultValue: "default",
      options: [
        { label: "Green (Done)", value: "green" },
        { label: "Yellow (In Progress)", value: "yellow" },
        { label: "Red (Overdue)", value: "red" },
        { label: "Blue (Upcoming)", value: "blue" },
        { label: "Gray (Not Started)", value: "gray" },
      ],
      admin: { description: "Calendar display color" },
    },
    {
      name: "notificationsSent",
      type: "array",
      fields: [
        {
          name: "daysUntilDeadline",
          type: "number",
          admin: { description: "e.g., 90, 60, 30, 14, 7" },
        },
        {
          name: "sentAt",
          type: "date",
          admin: { date: { pickerAppearance: "dayOnly" } },
        },
        {
          name: "retryCount",
          type: "number",
          defaultValue: 0,
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "Sent", value: "sent" },
            { label: "Failed", value: "failed" },
            { label: "Bounced", value: "bounced" },
          ],
          defaultValue: "sent",
        },
      ],
      admin: { description: "Email notification history" },
    },
    {
      name: "unsubscribed",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "User has opted out of notifications for this deadline",
      },
    },
    {
      name: "recurrenceRule",
      type: "text",
      admin: {
        description:
          "iCal RRULE for recurring deadlines, e.g., FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=22",
      },
    },
    {
      name: "tags",
      type: "array",
      fields: [{ name: "tag", type: "text" }],
      admin: { description: "Custom tags for filtering" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "Who created this deadline" },
    },
    {
      name: "confirmedAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayOnly" } },
    },
  ],
};
