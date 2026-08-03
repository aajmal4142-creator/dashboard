import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const PROCUREMENT_TRADEOFFS_SLUG = "procurement-tradeoffs" as const;

/**
 * Named procurement trade-off comparisons (cost vs carbon vs optional lead time).
 * User-entered options only — no paid supplier risk APIs, no AI scoring.
 */
export const ProcurementTradeoffs: CollectionConfig = {
  slug: PROCUREMENT_TRADEOFFS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "weightCost", "weightCarbon", "weightLead", "updatedAt"],
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
      index: true,
    },
    {
      name: "notes",
      type: "textarea",
    },
    {
      name: "weightCost",
      type: "number",
      required: true,
      min: 0,
      defaultValue: 1,
      admin: {
        description: "Relative weight for purchase cost (lower cost is better).",
      },
    },
    {
      name: "weightCarbon",
      type: "number",
      required: true,
      min: 0,
      defaultValue: 1,
      admin: {
        description: "Relative weight for estimated tCO₂e (lower is better).",
      },
    },
    {
      name: "weightLead",
      type: "number",
      required: true,
      min: 0,
      defaultValue: 0,
      admin: {
        description: "Relative weight for lead time in days. Set 0 to ignore lead time.",
      },
    },
    {
      name: "options",
      type: "array",
      labels: { singular: "Option", plural: "Options" },
      admin: {
        description:
          "Purchase alternatives. Carbon may be direct tCO₂e or factor × quantity.",
      },
      fields: [
        {
          name: "optionId",
          type: "text",
          required: true,
          admin: { description: "Stable client id for the option row." },
        },
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "cost",
          type: "number",
          min: 0,
          admin: {
            description:
              "Total purchase cost. Leave blank if unknown — never treated as zero.",
          },
        },
        {
          name: "tco2e",
          type: "number",
          min: 0,
          admin: {
            description: "Direct estimated emissions in tCO₂e, if known.",
          },
        },
        {
          name: "factorTco2ePerUnit",
          type: "number",
          min: 0,
          admin: {
            description: "tCO₂e per unit — used with quantity when tCO₂e is blank.",
          },
        },
        {
          name: "quantity",
          type: "number",
          min: 0,
          admin: {
            description: "Units purchased — paired with factor when tCO₂e is blank.",
          },
        },
        {
          name: "leadDays",
          type: "number",
          min: 0,
          admin: { description: "Optional lead time in calendar days." },
        },
      ],
    },
  ],
  timestamps: true,
};
