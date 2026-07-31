import type { CollectionConfig, CollectionSlug } from "payload";

import { tenantAccess } from "@/lib/access";
import { AUTOMATIONS_SLUG } from "@/collections/Automations";

export const AUTOMATION_RUNS_SLUG = "automation-runs" as const;

export const AutomationRuns: CollectionConfig = {
  slug: AUTOMATION_RUNS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: ["automation", "triggerType", "status", "matched", "createdAt"],
    description: "Light run log for automation executions",
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
      name: "automation",
      type: "relationship",
      relationTo: AUTOMATIONS_SLUG as CollectionSlug,
      required: true,
      index: true,
    },
    {
      name: "triggerType",
      type: "select",
      required: true,
      options: [
        { label: "Datapoint approved", value: "datapoint_approved" },
        { label: "Alert triggered", value: "alert_triggered" },
        { label: "Schedule", value: "schedule" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Success", value: "success" },
        { label: "Partial", value: "partial" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" },
      ],
      index: true,
    },
    {
      name: "matched",
      type: "checkbox",
      required: true,
      defaultValue: false,
    },
    {
      name: "actionsRun",
      type: "json",
      defaultValue: [],
    },
    {
      name: "actionsSkipped",
      type: "json",
      defaultValue: [],
    },
    {
      name: "error",
      type: "textarea",
    },
    {
      name: "context",
      type: "json",
      admin: {
        description: "Event payload snapshot (sanitized)",
      },
    },
  ],
  timestamps: true,
};
