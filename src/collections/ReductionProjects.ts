import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const REDUCTION_PROJECTS_SLUG = "reduction-projects" as const;

/**
 * Mitigation / reduction project execution tracker.
 * Planned vs actual tCO₂e — distinct from pathway math (SBTi / planner).
 */
export const ReductionProjects: CollectionConfig = {
  slug: REDUCTION_PROJECTS_SLUG,
  admin: {
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "status",
      "plannedReductionTco2e",
      "actualReductionTco2e",
      "owner",
      "updatedAt",
    ],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: "title",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "planned",
      index: true,
      options: [
        { label: "Planned", value: "planned" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      name: "plannedReductionTco2e",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Planned emissions reduction in tCO₂e.",
      },
    },
    {
      name: "actualReductionTco2e",
      type: "number",
      min: 0,
      admin: {
        description:
          "Measured / realised reduction in tCO₂e. Leave empty until known — never treat as zero in summaries.",
      },
    },
    {
      name: "owner",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Project owner name or email (free text).",
      },
    },
    {
      name: "startDate",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Optional project start date.",
      },
    },
    {
      name: "endDate",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Optional target or actual end date.",
      },
    },
    {
      name: "facility",
      type: "relationship",
      relationTo: "facilities",
      index: true,
      admin: {
        description: "Optional facility / site this project applies to.",
      },
    },
    {
      name: "metricKey",
      type: "text",
      index: true,
      admin: {
        description:
          "Optional metric definition key this project targets (e.g. electricity_kwh).",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
