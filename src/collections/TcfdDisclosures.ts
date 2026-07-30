import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const TCFD_DISCLOSURES_SLUG = "tcfd-disclosures" as const;

/**
 * TCFD climate disclosure — Governance, Strategy, Risk Management, Metrics & Targets.
 * Draft is editable; final is immutable (create a new year/version instead).
 */
export const TcfdDisclosures: CollectionConfig = {
  slug: TCFD_DISCLOSURES_SLUG,
  admin: {
    useAsTitle: "reportingYear",
    defaultColumns: ["organisation", "reportingYear", "status", "updatedAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== "update" || !originalDoc) return data;
        if (originalDoc.status !== "final") return data;

        if (data?.status !== undefined && data.status !== "final") {
          throw new Error(
            "Final TCFD disclosures are immutable. Create a new draft for another year instead of unfinalising.",
          );
        }

        const lockedKeys = [
          "answers",
          "emissionsSnapshot",
          "scenarioLinks",
          "reportingYear",
          "organisation",
          "period",
          "finalisedAt",
          "finalisedBy",
          "snapshot",
        ] as const;

        for (const key of lockedKeys) {
          if (Object.prototype.hasOwnProperty.call(data ?? {}, key)) {
            throw new Error(
              "Final TCFD disclosures are immutable. Create a new draft instead of editing a final disclosure.",
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
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      index: true,
    },
    {
      name: "reportingYear",
      type: "number",
      required: true,
      index: true,
      admin: { description: "Calendar / fiscal disclosure year" },
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
        description: "Map of questionId → { text, source, autoFilled, updatedAt }",
      },
    },
    {
      name: "emissionsSnapshot",
      type: "json",
      admin: {
        description:
          "Auto-populated Scope 1/2/3 from ClearESG calc at last autofill / finalise",
      },
    },
    {
      name: "scenarioLinks",
      type: "array",
      admin: { description: "Scenarios hooked into Strategy pillar" },
      fields: [
        {
          name: "scenario",
          type: "relationship",
          relationTo: "scenarios",
          required: true,
        },
        { name: "role", type: "text" },
        { name: "note", type: "textarea" },
      ],
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
        {
          name: "diff",
          type: "json",
          admin: { description: "Changed question ids or field paths" },
        },
      ],
    },
  ],
};
