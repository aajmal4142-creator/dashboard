import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const SCHEDULED_REPORTS_SLUG = "scheduled-reports" as const;

/**
 * Org-scoped scheduled report deliveries (daily / weekly / monthly).
 * nextRunAt is always stored as UTC; timezone is used only to compute the next wall-clock run.
 */
export const ScheduledReports: CollectionConfig = {
  slug: SCHEDULED_REPORTS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "organisation",
      "report",
      "format",
      "status",
      "nextRunAt",
      "lastStatus",
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
      name: "report",
      type: "relationship",
      relationTo: "reports",
      required: true,
      index: true,
    },
    {
      name: "schedule",
      type: "group",
      required: true,
      fields: [
        {
          name: "frequency",
          type: "select",
          required: true,
          options: [
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
          ],
        },
        {
          name: "time",
          type: "text",
          required: true,
          admin: {
            description: "Local wall-clock time HH:mm (24h) in the schedule timezone",
          },
        },
        {
          name: "timezone",
          type: "text",
          required: true,
          defaultValue: "UTC",
          admin: {
            description: "IANA timezone used to interpret time (nextRunAt stored in UTC)",
          },
        },
        {
          name: "dayOfWeek",
          type: "number",
          min: 1,
          max: 7,
          admin: {
            description: "ISO weekday 1=Mon … 7=Sun (weekly schedules)",
          },
        },
        {
          name: "dayOfMonth",
          type: "number",
          min: 1,
          max: 31,
          admin: {
            description: "Calendar day 1–31 (monthly schedules; clamped to month length)",
          },
        },
      ],
    },
    {
      name: "recipients",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        {
          name: "email",
          type: "email",
          required: true,
        },
        {
          name: "unsubscribed",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "Recipient opted out via unsubscribe link",
          },
        },
        {
          name: "unsubscribedAt",
          type: "date",
          admin: { date: { pickerAppearance: "dayAndTime" } },
        },
      ],
    },
    {
      name: "deliveryHistory",
      type: "array",
      admin: {
        description:
          "Per-recipient send outcomes (newest first; capped in application code)",
        readOnly: true,
      },
      fields: [
        {
          name: "runAt",
          type: "date",
          required: true,
          admin: {
            description: "Schedule slot (nextRunAt) this delivery belonged to",
            date: { pickerAppearance: "dayAndTime" },
          },
        },
        {
          name: "sentAt",
          type: "date",
          required: true,
          admin: { date: { pickerAppearance: "dayAndTime" } },
        },
        {
          name: "email",
          type: "email",
          required: true,
        },
        {
          name: "status",
          type: "select",
          required: true,
          options: [
            { label: "Sent", value: "sent" },
            { label: "Failed", value: "failed" },
            { label: "Skipped", value: "skipped" },
          ],
        },
        {
          name: "error",
          type: "text",
        },
        {
          name: "trackingId",
          type: "text",
          index: true,
          admin: { description: "Open-tracking pixel id" },
        },
        {
          name: "openCount",
          type: "number",
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: "openedAt",
          type: "date",
          admin: {
            readOnly: true,
            date: { pickerAppearance: "dayAndTime" },
          },
        },
        {
          name: "providerMessageId",
          type: "text",
          admin: { description: "Resend message id when available" },
        },
      ],
    },
    {
      name: "format",
      type: "select",
      required: true,
      defaultValue: "pdf",
      options: [
        { label: "PDF", value: "pdf" },
        { label: "CSV", value: "csv" },
        { label: "JSON", value: "json" },
        { label: "XML", value: "xml" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Completed", value: "completed" },
      ],
    },
    {
      name: "nextRunAt",
      type: "date",
      required: true,
      index: true,
      admin: {
        description: "Next due instant in UTC",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "lastRunAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "lastStatus",
      type: "select",
      options: [
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" },
      ],
    },
    {
      name: "lastError",
      type: "text",
      admin: { description: "Last failure message (truncated for UI)" },
    },
    {
      name: "retryCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      max: 3,
    },
    {
      name: "lastDeliveredForRunAt",
      type: "date",
      admin: {
        description:
          "UTC nextRunAt that was successfully delivered (idempotency key for that slot)",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "claimedAt",
      type: "date",
      admin: {
        description: "Worker claim timestamp to prevent duplicate concurrent sends",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "claimedRunAt",
      type: "date",
      admin: {
        description: "The nextRunAt slot currently claimed by a worker",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
