import type { CollectionConfig } from "payload";

import { authenticated, denyAll } from "@/lib/access";

/**
 * Platform seed data. Not user-created.
 * frameworkMappings stay empty until Phase 1c human-approved joins.
 */
export const MetricDefinitions: CollectionConfig = {
  slug: "metric-definitions",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["key", "category", "unit", "inputType"],
  },
  access: {
    read: authenticated,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    { name: "key", type: "text", required: true, unique: true, index: true },
    { name: "label", type: "text", required: true },
    { name: "description", type: "textarea", required: true },
    { name: "unit", type: "text" },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Environmental", value: "E" },
        { label: "Social", value: "S" },
        { label: "Governance", value: "G" },
      ],
    },
    {
      name: "inputType",
      type: "select",
      required: true,
      options: [
        { label: "Number", value: "number" },
        { label: "Boolean", value: "boolean" },
        { label: "Select", value: "select" },
      ],
    },
    { name: "helpText", type: "textarea", required: true },
    { name: "exampleSource", type: "text", required: true },
    {
      name: "calcRole",
      type: "text",
      required: true,
      admin: { description: "Which §5 formula term this feeds" },
    },
    {
      name: "frameworkMappings",
      type: "array",
      fields: [
        {
          name: "framework",
          type: "select",
          required: true,
          options: [
            { label: "CSRD Set 1", value: "CSRD_SET1" },
            { label: "CSRD Simplified", value: "CSRD_SIMPLIFIED" },
            { label: "BRSR", value: "BRSR" },
            { label: "VSME", value: "VSME" },
            { label: "GRI", value: "GRI" },
            { label: "ISSB S1", value: "ISSB_S1" },
            { label: "ISSB S2", value: "ISSB_S2" },
            { label: "EU Taxonomy", value: "EU_TAXONOMY" },
          ],
        },
        {
          name: "datapointRef",
          type: "text",
          required: true,
          admin: {
            description:
              "Disclosure code (product alias: disclosureCode). Not a datapoint document id.",
          },
        },
        {
          name: "label",
          type: "text",
          admin: { description: "Human disclosure name (counsel placeholder OK)." },
        },
        { name: "required", type: "checkbox", defaultValue: false },
        {
          name: "contributionOnly",
          type: "checkbox",
          defaultValue: true,
          admin: {
            description:
              "When true, data contributes to this disclosure — never alone satisfies it.",
          },
        },
        { name: "validFrom", type: "date" },
        { name: "validUntil", type: "date" },
        { name: "sourceDoc", type: "text" },
        { name: "sourceSheet", type: "text" },
        { name: "sourceRow", type: "number" },
        { name: "extractedAt", type: "date" },
      ],
    },
  ],
};
