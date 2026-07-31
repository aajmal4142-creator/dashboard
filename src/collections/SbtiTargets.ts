import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const SBTI_TARGETS_SLUG = "sbti-targets" as const;

/**
 * Organisation SBTi near-term / long-term targets with progress tracking.
 */
export const SbtiTargets: CollectionConfig = {
  slug: SBTI_TARGETS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "targetType",
      "baselineYear",
      "targetYear",
      "status",
      "updatedAt",
    ],
    preview: () => null,
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
      label: "Target name",
    },
    {
      name: "targetType",
      type: "select",
      required: true,
      options: [
        { label: "Absolute", value: "absolute" },
        { label: "Intensity (per revenue)", value: "intensity" },
      ],
      admin: {
        description:
          "Absolute = total tCO2e reduction. Intensity = tCO2e per revenue unit.",
      },
    },
    {
      name: "baselineYear",
      type: "number",
      required: true,
      min: 1990,
      max: 2100,
      admin: { description: "User-selected reference year — never hardcoded." },
    },
    {
      name: "baselineEmissions",
      type: "number",
      required: true,
      min: 0,
      label: "Baseline emissions / intensity",
      admin: {
        description: "Absolute: tCO2e. Intensity: tCO2e per $M revenue (or chosen unit).",
      },
    },
    {
      name: "targetYear",
      type: "number",
      required: true,
      min: 1990,
      max: 2100,
    },
    {
      name: "targetEmissions",
      type: "number",
      min: 0,
      label: "Target emissions / intensity",
      admin: {
        description:
          "Optional when reductionPercent is set. Absolute tCO2e or intensity.",
      },
    },
    {
      name: "reductionPercent",
      type: "number",
      min: 0,
      max: 100,
      label: "Target reduction (%)",
      admin: {
        description:
          "Optional when targetEmissions is set. Percent reduction from baseline.",
      },
    },
    {
      name: "scopesCovered",
      type: "select",
      hasMany: true,
      required: true,
      options: [
        { label: "Scope 1", value: "Scope1" },
        { label: "Scope 2", value: "Scope2" },
        { label: "Scope 3", value: "Scope3" },
      ],
      admin: { description: "GHG scopes included in this target." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Validated", value: "validated" },
        { label: "Approved", value: "approved" },
      ],
      admin: {
        description:
          "Status discipline: create as draft or submitted; advance to validated/approved later.",
      },
    },
    {
      name: "validationUrl",
      type: "text",
      label: "SBTi register URL",
      admin: {
        description: "Public link on the SBTi companies-taking-action register.",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
