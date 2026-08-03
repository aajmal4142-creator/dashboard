import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ABATEMENT_LEVERS_SLUG = "abatement-levers" as const;

/**
 * Decarbonisation levers for the non-paid MACC / abatement ROI view.
 * User-entered costs and abatement only — no paid factor APIs.
 */
export const AbatementLevers: CollectionConfig = {
  slug: ABATEMENT_LEVERS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "category",
      "annualAbatementTco2e",
      "capex",
      "opexPerYear",
      "lifetimeYears",
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
      name: "name",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "category",
      type: "select",
      index: true,
      options: [
        { label: "Energy efficiency", value: "energy_efficiency" },
        { label: "Renewable electricity", value: "renewable_electricity" },
        { label: "Process / fuel switch", value: "process_fuel" },
        { label: "Fleet / transport", value: "fleet_transport" },
        { label: "Nature / offsets (memo)", value: "nature_offsets" },
        { label: "Other", value: "other" },
      ],
      admin: {
        description: "Optional grouping for the MACC table. Does not affect cost/tCO₂e.",
      },
    },
    {
      name: "annualAbatementTco2e",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description:
          "Expected annual abatement in tCO₂e. Missing or zero blocks cost/tCO₂e on the curve.",
      },
    },
    {
      name: "capex",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Upfront capital cost in org currency units (not converted).",
      },
    },
    {
      name: "opexPerYear",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Net incremental operating cost per year (same currency as CAPEX).",
      },
    },
    {
      name: "lifetimeYears",
      type: "number",
      required: true,
      min: 1,
      admin: {
        description:
          "Economic lifetime in whole years for straight-line CAPEX amortisation.",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
      admin: {
        description: "Inactive levers are hidden from the default MACC compute.",
      },
    },
  ],
  timestamps: true,
};
