import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const COMPLIANCE_ASSESSMENTS_SLUG = "compliance-assessments" as const;

/**
 * Filled compliance assessments against a ReportTemplates (purpose=compliance) template.
 * Draft is editable; final is immutable.
 */
export const ComplianceAssessments: CollectionConfig = {
  slug: COMPLIANCE_ASSESSMENTS_SLUG,
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "organisation", "reportingYear", "status", "updatedAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== "update" || !originalDoc) return data;
        if (originalDoc.status !== "final") return data;

        if (data?.status !== undefined && data.status !== "final") {
          throw new Error(
            "Final assessments are immutable. Create a new draft instead of unfinalising.",
          );
        }

        const lockedKeys = [
          "answers",
          "calculationResults",
          "template",
          "templateSnapshot",
          "reportingYear",
          "organisation",
          "title",
          "finalisedAt",
          "finalisedBy",
          "snapshot",
        ] as const;

        for (const key of lockedKeys) {
          if (Object.prototype.hasOwnProperty.call(data ?? {}, key)) {
            throw new Error(
              "Final assessments are immutable. Create a new draft instead of editing a final assessment.",
            );
          }
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "template",
      type: "relationship",
      relationTo: "report-templates",
      required: true,
      index: true,
      admin: { description: "Compliance template this assessment fills" },
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "reportingYear",
      type: "number",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Final", value: "final" },
      ],
      index: true,
    },
    {
      name: "answers",
      type: "json",
      admin: {
        description: "Map of questionId → { value, updatedAt }",
      },
    },
    {
      name: "calculationResults",
      type: "json",
      admin: {
        description: "Computed outputs from template calculations",
      },
    },
    {
      name: "templateSnapshot",
      type: "json",
      admin: {
        description: "Frozen template structure at assessment create / finalise",
      },
    },
    {
      name: "snapshot",
      type: "json",
      admin: { description: "Immutable publish payload for PDF — set on finalise" },
    },
    { name: "finalisedAt", type: "date" },
    {
      name: "finalisedBy",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "changeHistory",
      type: "array",
      admin: { description: "Append-only audit of answer / status changes" },
      fields: [
        { name: "at", type: "date", required: true },
        {
          name: "actor",
          type: "relationship",
          relationTo: "users",
        },
        { name: "action", type: "text", required: true },
        { name: "summary", type: "text" },
        { name: "diff", type: "json" },
      ],
    },
  ],
};
