import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const CASCADED_TARGETS_SLUG = "cascaded-targets" as const;

/**
 * Org-level climate / emissions targets cascaded to facilities (optional owners)
 * via share % or absolute child targets.
 */
export const CascadedTargets: CollectionConfig = {
  slug: CASCADED_TARGETS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "baselineYear",
      "targetYear",
      "orgTargetTco2e",
      "status",
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
      name: "name",
      type: "text",
      required: true,
      label: "Cascade name",
    },
    {
      name: "sbtiTarget",
      type: "relationship",
      relationTo: "sbti-targets",
      admin: {
        description: "Optional link to an org SBTi target (read-only reference).",
      },
    },
    {
      name: "baselineYear",
      type: "number",
      required: true,
      min: 1990,
      max: 2100,
    },
    {
      name: "targetYear",
      type: "number",
      required: true,
      min: 1990,
      max: 2100,
    },
    {
      name: "orgBaselineTco2e",
      type: "number",
      required: true,
      min: 0,
      label: "Org baseline (tCO₂e)",
    },
    {
      name: "orgTargetTco2e",
      type: "number",
      required: true,
      min: 0,
      label: "Org target (tCO₂e)",
    },
    {
      name: "requireExactShares",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "When on, share-% rows must sum to exactly 100%. When off, sum must be ≤ 100%.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      index: true,
    },
    {
      name: "notes",
      type: "textarea",
    },
    {
      name: "abatementLevers",
      type: "relationship",
      relationTo: "abatement-levers",
      hasMany: true,
      admin: {
        description:
          "Abatement levers (MACC) that this cascade's plan relies on — read-only reference for the decarbon plan panel.",
      },
    },
    {
      name: "reductionProjects",
      type: "relationship",
      relationTo: "reduction-projects",
      hasMany: true,
      admin: {
        description:
          "Reduction projects executing against this cascade — read-only reference for the decarbon plan panel.",
      },
    },
    {
      name: "allocations",
      type: "array",
      labels: { singular: "Allocation", plural: "Allocations" },
      admin: {
        description:
          "Facility (optional owner) child targets as share % of org target or absolute tCO₂e.",
      },
      fields: [
        {
          name: "facility",
          type: "relationship",
          relationTo: "facilities",
          required: true,
        },
        {
          name: "owner",
          type: "relationship",
          relationTo: "users",
          admin: {
            description: "Optional accountable owner for this facility slice.",
          },
        },
        {
          name: "mode",
          type: "select",
          required: true,
          defaultValue: "sharePct",
          options: [
            { label: "Share %", value: "sharePct" },
            { label: "Absolute tCO₂e", value: "absolute" },
          ],
        },
        {
          name: "sharePct",
          type: "number",
          min: 0,
          max: 100,
          admin: {
            condition: (_, siblingData) => siblingData?.mode === "sharePct",
            description: "Percent of org target allocated to this child.",
          },
        },
        {
          name: "absoluteTco2e",
          type: "number",
          min: 0,
          admin: {
            condition: (_, siblingData) => siblingData?.mode === "absolute",
            description: "Absolute child target emissions (tCO₂e).",
          },
        },
        {
          name: "reportedCurrentTco2e",
          type: "number",
          min: 0,
          admin: {
            description:
              "Optional reported current emissions for progress. Leave empty when unknown — never treated as zero.",
          },
        },
        {
          name: "notes",
          type: "textarea",
        },
      ],
    },
  ],
  timestamps: true,
};
