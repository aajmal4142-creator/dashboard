import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const GREEN_TAXONOMY_ASSESSMENTS_SLUG = "green-taxonomy-assessments" as const;

/**
 * Per-organisation EU Green Taxonomy alignment assessments (Reg. 2020/852).
 * NACE codes and criteria come from bundled catalogs — never hardcoded in UI.
 */
export const GreenTaxonomyAssessments: CollectionConfig = {
  slug: GREEN_TAXONOMY_ASSESSMENTS_SLUG,
  admin: {
    useAsTitle: "naceCode",
    defaultColumns: [
      "organisation",
      "naceCode",
      "period",
      "status",
      "overallAlignmentPercent",
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
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      index: true,
      admin: {
        description: "Reporting period for this taxonomy assessment.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Completed", value: "completed" },
        { label: "Verified", value: "verified" },
      ],
      index: true,
    },
    {
      name: "naceCode",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Primary NACE Rev. 2 code (from official Eurostat catalog).",
      },
    },
    {
      name: "naceName",
      type: "text",
      admin: { description: "Denormalised NACE label at save time." },
    },
    {
      name: "objectives",
      type: "array",
      labels: { singular: "Objective", plural: "Objectives" },
      fields: [
        {
          name: "objective",
          type: "select",
          required: true,
          options: [
            { label: "Climate change mitigation", value: "climate_mitigation" },
            { label: "Climate change adaptation", value: "climate_adaptation" },
            { label: "Water and marine resources", value: "water" },
            { label: "Circular economy", value: "circular_economy" },
            { label: "Pollution prevention", value: "pollution" },
            { label: "Biodiversity and ecosystems", value: "biodiversity" },
          ],
        },
        {
          name: "applicable",
          type: "select",
          required: true,
          defaultValue: "unanswered",
          options: [
            { label: "Unanswered", value: "unanswered" },
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
        {
          name: "criteriasMet",
          type: "number",
          min: 0,
          max: 100,
          admin: {
            description: "Cached alignment % for this objective (0–100).",
          },
        },
        {
          name: "evidence",
          type: "relationship",
          relationTo: "evidence",
          hasMany: true,
          admin: { description: "Supporting evidence for this objective." },
        },
        {
          name: "answers",
          type: "array",
          fields: [
            {
              name: "criteriaId",
              type: "text",
              required: true,
            },
            {
              name: "met",
              type: "select",
              required: true,
              defaultValue: "unanswered",
              options: [
                { label: "Unanswered", value: "unanswered" },
                { label: "Yes", value: "yes" },
                { label: "No", value: "no" },
              ],
            },
            {
              name: "evidence",
              type: "relationship",
              relationTo: "evidence",
            },
            {
              name: "notes",
              type: "textarea",
            },
          ],
        },
      ],
    },
    {
      name: "dnshCompliance",
      type: "array",
      labels: { singular: "DNSH criterion", plural: "DNSH criteria" },
      fields: [
        {
          name: "objective",
          type: "select",
          required: true,
          options: [
            { label: "Climate change mitigation", value: "climate_mitigation" },
            { label: "Climate change adaptation", value: "climate_adaptation" },
            { label: "Water and marine resources", value: "water" },
            { label: "Circular economy", value: "circular_economy" },
            { label: "Pollution prevention", value: "pollution" },
            { label: "Biodiversity and ecosystems", value: "biodiversity" },
          ],
        },
        {
          name: "criteriaId",
          type: "text",
          required: true,
        },
        {
          name: "compliant",
          type: "select",
          required: true,
          defaultValue: "unanswered",
          options: [
            { label: "Unanswered", value: "unanswered" },
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
        {
          name: "notes",
          type: "textarea",
        },
      ],
    },
    {
      name: "overallAlignmentPercent",
      type: "number",
      min: 0,
      max: 100,
      admin: {
        description:
          "Mean alignment of applicable objectives only (non-applicable excluded).",
        readOnly: true,
      },
    },
    {
      name: "wizardStep",
      type: "number",
      min: 1,
      max: 7,
      defaultValue: 1,
      admin: { description: "Current wizard step (1 NACE + 6 objectives)." },
    },
    {
      name: "completedAt",
      type: "date",
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
