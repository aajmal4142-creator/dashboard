import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ISSB_DISCLOSURES_SLUG = "issb-disclosures" as const;

/**
 * ISSB S1 (general) + S2 (climate). S2 extends TCFD — optional link to a TCFD disclosure.
 * Draft is editable; final is immutable.
 */
export const IssbDisclosures: CollectionConfig = {
  slug: ISSB_DISCLOSURES_SLUG,
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
            "Final ISSB disclosures are immutable. Create a new draft for another year instead of unfinalising.",
          );
        }

        const lockedKeys = [
          "answers",
          "s1Answers",
          "s2Answers",
          "emissionsSnapshot",
          "linkedTcfd",
          "materialitySummary",
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
              "Final ISSB disclosures are immutable. Create a new draft instead of editing a final disclosure.",
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
      name: "linkedTcfd",
      type: "relationship",
      relationTo: "tcfd-disclosures",
      admin: {
        description:
          "Optional TCFD disclosure — S2 climate answers inherit / compare against it",
      },
    },
    {
      name: "s1Answers",
      type: "json",
      admin: { description: "ISSB S1 general sustainability answers" },
    },
    {
      name: "s2Answers",
      type: "json",
      admin: {
        description:
          "ISSB S2 climate answers (extends TCFD pillars). May mirror linked TCFD answers.",
      },
    },
    {
      name: "emissionsSnapshot",
      type: "json",
      admin: { description: "Auto-populated Scope 1/2/3 from ClearESG calc" },
    },
    {
      name: "materialitySummary",
      type: "json",
      admin: { description: "Optional materiality assessment summary for S1" },
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
