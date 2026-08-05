import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const MaterialityAssessments: CollectionConfig = {
  slug: "materiality-assessments",
  admin: {
    defaultColumns: ["organisation", "period", "status", "finalisedAt"],
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
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
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
    },
    {
      name: "topics",
      type: "array",
      fields: [
        { name: "esrsTopic", type: "text", required: true },
        { name: "impactSeverity", type: "number", min: 0, max: 5 },
        { name: "impactScope", type: "number", min: 0, max: 5 },
        { name: "impactIrremediability", type: "number", min: 0, max: 5 },
        { name: "financialMagnitude", type: "number", min: 0, max: 5 },
        { name: "financialLikelihood", type: "number", min: 0, max: 5 },
        { name: "impactScore", type: "number", required: true, min: 0, max: 5 },
        {
          name: "financialScore",
          type: "number",
          required: true,
          min: 0,
          max: 5,
        },
        { name: "rationale", type: "textarea" },
        {
          name: "stakeholderSurveyAvg",
          type: "number",
          min: 0,
          max: 5,
          admin: {
            description:
              "Optional stakeholder survey average (0-5) for this topic, if collected outside the platform.",
          },
        },
        {
          name: "iros",
          type: "array",
          label: "Impacts, risks, opportunities",
          admin: {
            description:
              "IRO register entries backing the impact/financial scores for this topic.",
          },
          fields: [
            {
              name: "kind",
              type: "select",
              required: true,
              options: [
                { label: "Impact", value: "impact" },
                { label: "Risk", value: "risk" },
                { label: "Opportunity", value: "opportunity" },
              ],
            },
            { name: "description", type: "textarea", required: true },
            { name: "severity", type: "number", required: true, min: 0, max: 5 },
          ],
        },
        {
          name: "origin",
          type: "select",
          defaultValue: "suggested",
          options: [
            { label: "Suggested (sector default accepted)", value: "suggested" },
            { label: "Adjusted (deliberated)", value: "adjusted" },
          ],
          admin: {
            description:
              "Auditor trail — sector starting position accepted vs actively changed.",
          },
        },
        {
          name: "decidedBy",
          type: "relationship",
          relationTo: "users",
        },
        { name: "decidedAt", type: "date" },
      ],
    },
    { name: "matrixSnapshot", type: "json" },
    { name: "narrative", type: "textarea" },
    {
      name: "surveyNotes",
      type: "textarea",
      admin: {
        description: "Optional stakeholder engagement / survey methodology notes.",
      },
    },
    { name: "finalisedAt", type: "date" },
  ],
};
