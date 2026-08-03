import type { CollectionConfig } from "payload";

import { authenticated, denyAll } from "@/lib/access";

/**
 * Versioned factor registry. NEVER hardcode factors in calc code.
 * licence + attributionText required — OGL and similar demand visible attribution.
 *
 * Global seed rows have organisation unset. Org-scoped custom rows are created via
 * app factor-admin APIs (overrideAccess) — Payload admin create/update stays denied.
 */
export const EmissionFactors: CollectionConfig = {
  slug: "emission-factors",
  admin: {
    useAsTitle: "label",
    defaultColumns: [
      "key",
      "region",
      "publicationYear",
      "standard",
      "source",
      "status",
      "licence",
    ],
  },
  access: {
    read: authenticated,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      index: true,
      admin: {
        description:
          "Unset for global seed factors. Set for organisation-owned custom registry rows.",
      },
    },
    { name: "key", type: "text", required: true, index: true },
    { name: "label", type: "text", required: true },
    { name: "value", type: "number", required: true },
    {
      name: "unit",
      type: "text",
      required: true,
      admin: { description: "e.g. kgCO2e/kWh" },
    },
    {
      name: "scope",
      type: "select",
      required: true,
      options: [
        { label: "Scope 1", value: "1" },
        { label: "Scope 2", value: "2" },
        { label: "Scope 3", value: "3" },
      ],
      index: true,
    },
    {
      name: "source",
      type: "select",
      required: true,
      options: [
        { label: "DEFRA", value: "DEFRA" },
        { label: "EPA", value: "EPA" },
        { label: "IEA", value: "IEA" },
        { label: "CEA India", value: "CEA_India" },
        { label: "GHG Protocol", value: "GHGProtocol" },
        { label: "IPCC", value: "IPCC" },
        { label: "EEA", value: "EEA" },
        { label: "National inventory", value: "NationalInventory" },
        { label: "Organisation custom", value: "Custom" },
      ],
      admin: {
        description:
          "Publisher / citation for this factor row (not the org methodology selector).",
      },
    },
    {
      name: "standard",
      type: "select",
      required: true,
      index: true,
      defaultValue: "GHGProtocol2004",
      options: [
        { label: "DEFRA", value: "DEFRA" },
        { label: "IPCC", value: "IPCC" },
        { label: "GHG Protocol 2004", value: "GHGProtocol2004" },
      ],
      admin: {
        description:
          "Methodology family used when an organisation selects its emissions standard. Distinct from source.",
      },
    },
    { name: "sourceUrl", type: "text", required: true },
    { name: "publicationYear", type: "number", required: true },
    {
      name: "region",
      type: "text",
      required: true,
      index: true,
      admin: { description: "ISO 3166-1 alpha-2 or GLOBAL" },
    },
    {
      name: "uncertaintyPct",
      type: "number",
      min: 0,
      max: 100,
      admin: {
        description: "Relative uncertainty band (±%), when the source publishes one.",
      },
    },
    { name: "validFrom", type: "date", required: true },
    { name: "validUntil", type: "date" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Deactivated", value: "deactivated" },
      ],
      admin: {
        description:
          "Deactivated custom rows stay in the registry for audit but are not injected into calc.",
      },
    },
    {
      name: "supersededBy",
      type: "relationship",
      relationTo: "emission-factors",
    },
    {
      name: "licence",
      type: "text",
      required: true,
      admin: {
        description: "e.g. OGL v3.0, US public domain, Government of India",
      },
    },
    {
      name: "attributionText",
      type: "textarea",
      required: true,
      admin: {
        description: "Visible attribution string required by the licence (OGL etc.)",
      },
    },
  ],
};
