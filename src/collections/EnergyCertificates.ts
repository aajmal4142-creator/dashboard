import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ENERGY_CERTIFICATES_SLUG = "energy-certificates" as const;

/**
 * REC / GO / EAC / PPA / green-tariff inventory for market-based Scope 2.
 * User-entered or CSV only — no paid registry APIs.
 */
export const EnergyCertificates: CollectionConfig = {
  slug: ENERGY_CERTIFICATES_SLUG,
  admin: {
    useAsTitle: "label",
    defaultColumns: [
      "certificateType",
      "volumeKwh",
      "vintageYear",
      "region",
      "status",
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
        description:
          "Optional display label (serial / contract id). Falls back to type + vintage in UI.",
      },
    },
    {
      name: "certificateType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "REC", value: "REC" },
        { label: "GO (Guarantee of Origin)", value: "GO" },
        { label: "EAC", value: "EAC" },
        { label: "PPA", value: "PPA" },
        { label: "Green tariff", value: "green_tariff" },
      ],
    },
    {
      name: "volumeKwh",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Certificate or contract volume in kilowatt-hours.",
      },
    },
    {
      name: "factorKgPerKwh",
      type: "number",
      min: 0,
      admin: {
        description:
          "Optional instrument emission factor (kgCO2e/kWh). When omitted, market-based Scope 2 uses 0 kgCO2e/kWh (estimated zero-emission renewable claim).",
      },
    },
    {
      name: "vintageYear",
      type: "number",
      required: true,
      min: 1990,
      max: 2100,
      index: true,
      admin: { description: "Generation / vintage year of the instrument." },
    },
    {
      name: "region",
      type: "text",
      required: true,
      index: true,
      admin: {
        description:
          "Geography of generation or delivery (ISO country, grid region, or free text).",
      },
    },
    {
      name: "country",
      type: "text",
      admin: {
        description:
          "Optional ISO 3166-1 alpha-2 country code when region is a sub-national label.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Retired", value: "retired" },
        { label: "Expired", value: "expired" },
      ],
    },
    {
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
      admin: {
        description: "Reporting period this volume applies to for Scope 2 matching.",
      },
    },
    {
      name: "supplier",
      type: "text",
      admin: { description: "Optional supplier, issuer, or counterparty name." },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
