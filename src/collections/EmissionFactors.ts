import type { CollectionConfig } from "payload";

import { authenticated, denyAll } from "@/lib/access";

/**
 * Versioned factor registry. NEVER hardcode factors in calc code.
 * licence + attributionText required — OGL and similar demand visible attribution.
 */
export const EmissionFactors: CollectionConfig = {
  slug: "emission-factors",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["key", "region", "publicationYear", "source", "licence"],
  },
  access: {
    read: authenticated,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
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
        { label: "EEA", value: "EEA" },
        { label: "National inventory", value: "NationalInventory" },
      ],
    },
    { name: "sourceUrl", type: "text", required: true },
    { name: "publicationYear", type: "number", required: true },
    {
      name: "region",
      type: "text",
      required: true,
      admin: { description: "ISO 3166-1 alpha-2 or GLOBAL" },
    },
    { name: "validFrom", type: "date", required: true },
    { name: "validUntil", type: "date" },
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
