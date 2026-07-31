import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const AUTOMATIONS_SLUG = "automations" as const;

export const Automations: CollectionConfig = {
  slug: AUTOMATIONS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "enabled", "triggerType", "runCount", "lastRunAt"],
    description: "If-then automation rules: trigger + conditions + actions",
  },
  access: tenantAccess({ writeMin: "admin" }),
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
    },
    {
      name: "enabled",
      type: "checkbox",
      required: true,
      defaultValue: true,
      index: true,
    },
    {
      name: "triggerType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Datapoint approved", value: "datapoint_approved" },
        { label: "Alert triggered", value: "alert_triggered" },
        { label: "Schedule", value: "schedule" },
      ],
    },
    {
      name: "cronExpression",
      type: "text",
      admin: {
        description:
          "5-field cron (minute hour day month weekday). Evaluated by cron every 5 minutes.",
        condition: (_, siblingData) => siblingData?.triggerType === "schedule",
      },
    },
    {
      name: "conditions",
      type: "json",
      required: true,
      defaultValue: [],
      admin: {
        description:
          "Array of { field, operator, value }. Empty array = match all events of this trigger.",
      },
    },
    {
      name: "actions",
      type: "json",
      required: true,
      admin: {
        description: "Array of { type, title?, message?, emailTo?, webhookUrl? }",
      },
    },
    {
      name: "runCount",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "lastRunAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "lastRunStatus",
      type: "select",
      options: [
        { label: "Success", value: "success" },
        { label: "Partial", value: "partial" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" },
      ],
      admin: { readOnly: true },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
  timestamps: true,
};
