import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const FINANCED_EMISSIONS_SLUG = "financed-emissions" as const;

/**
 * PCAF-style financed-emissions exposures (loans / investments). In-house
 * Category 15 beachhead — not a PCAF Association certification. Missing
 * EVIC or borrower emissions stay `null`; the attribution calc in
 * `lib/pcaf` never coerces an absent input to zero.
 */
export const FinancedEmissions: CollectionConfig = {
  slug: FINANCED_EMISSIONS_SLUG,
  admin: {
    useAsTitle: "counterparty",
    defaultColumns: [
      "counterparty",
      "assetClass",
      "outstandingAmount",
      "evic",
      "dataSource",
      "period",
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
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      index: true,
      admin: {
        description: "Optional reporting period this exposure applies to.",
      },
    },
    {
      name: "counterparty",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Borrower / investee name." },
    },
    {
      name: "assetClass",
      type: "select",
      required: true,
      defaultValue: "listed_equity_corporate_bonds",
      options: [
        {
          label: "Listed equity & corporate bonds",
          value: "listed_equity_corporate_bonds",
        },
        {
          label: "Business loans & unlisted equity",
          value: "business_loans_unlisted_equity",
        },
        { label: "Project finance", value: "project_finance" },
        { label: "Commercial real estate", value: "commercial_real_estate" },
        { label: "Motor vehicle loans", value: "motor_vehicle_loans" },
      ],
      admin: {
        description:
          "PCAF asset class. Attribution formula applied is common to all classes in this beachhead (outstanding / EVIC); class-specific denominators (e.g. property value, total project cost) are not yet modelled separately.",
      },
    },
    {
      name: "outstandingAmount",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Outstanding loan / investment amount (reporting currency).",
      },
    },
    {
      name: "evic",
      type: "number",
      min: 0,
      admin: {
        description:
          "Enterprise Value Including Cash (listed) or total equity + debt (private). Leave empty when unknown — attribution stays quality-missing, never a fabricated factor.",
      },
    },
    {
      name: "currency",
      type: "select",
      required: true,
      defaultValue: "USD",
      options: [
        { label: "USD", value: "USD" },
        { label: "EUR", value: "EUR" },
        { label: "GBP", value: "GBP" },
        { label: "INR", value: "INR" },
      ],
    },
    {
      name: "borrowerScope1Tco2e",
      type: "number",
      min: 0,
      admin: {
        description: "Borrower's Scope 1 emissions (tCO2e). Leave empty if unknown.",
      },
    },
    {
      name: "borrowerScope2Tco2e",
      type: "number",
      min: 0,
      admin: {
        description: "Borrower's Scope 2 emissions (tCO2e). Leave empty if unknown.",
      },
    },
    {
      name: "borrowerScope3Tco2e",
      type: "number",
      min: 0,
      admin: {
        description:
          "Borrower's Scope 3 emissions (tCO2e), optional additive per PCAF guidance.",
      },
    },
    {
      name: "dataSource",
      type: "select",
      required: true,
      defaultValue: "economic_activity_proxy",
      options: [
        { label: "Verified reported emissions (score 1)", value: "verified_reported" },
        {
          label: "Unverified reported emissions (score 2)",
          value: "unverified_reported",
        },
        {
          label: "Primary physical activity data (score 3)",
          value: "physical_activity_primary",
        },
        {
          label: "Proxy physical activity / sector average (score 4)",
          value: "physical_activity_proxy",
        },
        {
          label: "Economic activity proxy — revenue-based (score 5)",
          value: "economic_activity_proxy",
        },
      ],
      admin: {
        description: "PCAF data-quality source classification — drives the 1–5 score.",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
