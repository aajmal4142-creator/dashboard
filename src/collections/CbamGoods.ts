import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const CBAM_GOODS_SLUG = "cbam-goods" as const;

/**
 * Individual CBAM-covered goods lines (user-entered / CSV).
 * No paid customs APIs — CN code, mass, and embedded emissions are operator-supplied.
 */
export const CbamGoods: CollectionConfig = {
  slug: CBAM_GOODS_SLUG,
  admin: {
    useAsTitle: "cnCode",
    defaultColumns: [
      "cnCode",
      "quantity",
      "installationCountry",
      "reportingYear",
      "reportingQuarter",
      "usesDefaultValues",
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
      name: "cnCode",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Combined Nomenclature (CN) code for the imported good.",
      },
    },
    {
      name: "description",
      type: "text",
      admin: { description: "Optional goods description / commercial name." },
    },
    {
      name: "quantity",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Net mass / quantity of the consignment." },
    },
    {
      name: "quantityUnit",
      type: "select",
      required: true,
      defaultValue: "t",
      options: [
        { label: "Tonnes (t)", value: "t" },
        { label: "Kilograms (kg)", value: "kg" },
        { label: "Megawatt-hours (MWh)", value: "mwh" },
      ],
    },
    {
      name: "directEmissions",
      type: "number",
      min: 0,
      admin: {
        description:
          "Specific direct embedded emissions (tCO₂e per quantity unit). Leave empty when unknown — never coerce to zero.",
      },
    },
    {
      name: "indirectEmissions",
      type: "number",
      min: 0,
      admin: {
        description:
          "Specific indirect embedded emissions (tCO₂e per quantity unit). Leave empty when unknown.",
      },
    },
    {
      name: "usesDefaultValues",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "True when Commission default values were used instead of actual installation data.",
      },
    },
    {
      name: "installationCountry",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "ISO 3166-1 alpha-2 country of the producing installation.",
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
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
