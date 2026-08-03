import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const SHARED_EMISSION_SNAPSHOTS_SLUG = "shared-emission-snapshots" as const;

/**
 * Explicit consented emission totals shared into a buyer org (F30).
 * Null scopes mean not shared — never invent zeros.
 */
export const SharedEmissionSnapshots: CollectionConfig = {
  slug: SHARED_EMISSION_SNAPSHOTS_SLUG,
  admin: {
    useAsTitle: "periodLabel",
    defaultColumns: [
      "periodLabel",
      "organisation",
      "supplierOrganisation",
      "scope1Tco2e",
      "scope2Tco2e",
      "scope3Tco2e",
      "quality",
      "consentedAt",
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
      admin: {
        description: "Buyer organisation receiving the consented share",
        hidden: true,
      },
    },
    {
      name: "supplierOrganisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: {
        description: "Supplier organisation that consented to share",
      },
    },
    {
      name: "invite",
      type: "relationship",
      relationTo: "supplier-network-invites",
      required: true,
      index: true,
    },
    {
      name: "periodLabel",
      type: "text",
      required: true,
      admin: {
        description: 'Reporting period label, e.g. "FY2024" or "2024"',
      },
    },
    {
      name: "periodStart",
      type: "date",
      admin: { description: "Optional period start (ISO date)" },
    },
    {
      name: "periodEnd",
      type: "date",
      admin: { description: "Optional period end (ISO date)" },
    },
    {
      name: "scope1Tco2e",
      type: "number",
      min: 0,
      admin: {
        description: "Scope 1 total tCO₂e. Null = not shared (never treated as zero).",
      },
    },
    {
      name: "scope2Tco2e",
      type: "number",
      min: 0,
      admin: {
        description: "Scope 2 total tCO₂e. Null = not shared (never treated as zero).",
      },
    },
    {
      name: "scope3Tco2e",
      type: "number",
      min: 0,
      admin: {
        description:
          "Optional Scope 3 total tCO₂e. Null = not shared (never treated as zero).",
      },
    },
    {
      name: "quality",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Measured", value: "measured" },
        { label: "Partial", value: "partial" },
        { label: "Missing", value: "missing" },
      ],
      admin: {
        description:
          "measured = Scope 1+2 present; partial = one of 1/2; missing = neither",
      },
    },
    {
      name: "consentedAt",
      type: "date",
      required: true,
      index: true,
    },
    {
      name: "consentedBy",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "note",
      type: "textarea",
      admin: { description: "Optional supplier note with the share" },
    },
  ],
  timestamps: true,
};
