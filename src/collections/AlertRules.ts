import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ALERT_RULES_SLUG = "alert-rules" as const;

export const AlertRules: CollectionConfig = {
  slug: ALERT_RULES_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "enabled", "muted", "triggeredCount", "lastTriggeredAt"],
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
      name: "condition",
      type: "json",
      required: true,
      admin: {
        description:
          "threshold | consecutive | percent_change | cross_metric condition object",
      },
    },
    {
      name: "actions",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["notify_user"],
      options: [
        { label: "In-app notification", value: "notify_user" },
        { label: "Email", value: "send_email" },
        { label: "Slack", value: "post_slack" },
      ],
    },
    {
      name: "muted",
      type: "checkbox",
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      name: "mutedUntil",
      type: "date",
      admin: {
        description:
          "When set, mute expires at this time. Null = indefinite while muted.",
      },
    },
    {
      name: "triggeredCount",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "lastTriggeredAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "lastTriggeredMessage",
      type: "textarea",
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
