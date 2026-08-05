import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const CBAM_DECLARATIONS_SLUG = "cbam-declarations" as const;

/**
 * Quarterly CBAM declaration draft for an organisation.
 * Liability estimates use the operator-supplied certificate price — never a silent default.
 */
export const CbamDeclarations: CollectionConfig = {
  slug: CBAM_DECLARATIONS_SLUG,
  admin: {
    useAsTitle: "label",
    defaultColumns: [
      "reportingYear",
      "reportingQuarter",
      "status",
      "certificatePriceEur",
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
      name: "label",
      type: "text",
      admin: {
        description: "Denormalised label (e.g. 2026 Q1) for admin lists.",
      },
    },
    {
      name: "reportingYear",
      type: "number",
      required: true,
      min: 2023,
      max: 2100,
      index: true,
    },
    {
      name: "reportingQuarter",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Q1", value: "1" },
        { label: "Q2", value: "2" },
        { label: "Q3", value: "3" },
        { label: "Q4", value: "4" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Ready", value: "ready" },
        { label: "Submitted", value: "submitted" },
      ],
      index: true,
    },
    {
      name: "declarantName",
      type: "text",
      admin: { description: "CBAM declarant / importer legal name" },
    },
    {
      name: "declarantEori",
      type: "text",
      admin: { description: "EORI number" },
    },
    {
      name: "declarantCountry",
      type: "text",
      admin: { description: "Declarant country (ISO-2)" },
    },
    {
      name: "declarantEmail",
      type: "email",
      admin: { description: "Declarant contact email" },
    },
    {
      name: "certificatePriceEur",
      type: "number",
      min: 0,
      admin: {
        description:
          "Operator-entered CBAM certificate price estimate (€ / tCO₂e). Required for liability estimates; never silently defaulted.",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
