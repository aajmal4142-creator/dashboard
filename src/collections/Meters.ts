import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

import { FACILITIES_SLUG } from "./Facilities";

export const METERS_SLUG = "meters" as const;

/**
 * Utility meters attached to a facility.
 * externalId links to IoT / billing identifiers when present.
 */
export const Meters: CollectionConfig = {
  slug: METERS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "utility", "unit", "externalId", "facility", "updatedAt"],
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
      name: "facility",
      type: "relationship",
      relationTo: FACILITIES_SLUG,
      required: true,
      index: true,
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "utility",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Electricity", value: "electricity" },
        { label: "Gas", value: "gas" },
        { label: "Water", value: "water" },
        { label: "Heat", value: "heat" },
      ],
    },
    {
      name: "unit",
      type: "text",
      required: true,
      admin: { description: "e.g. kWh, m³, therm, GJ." },
    },
    {
      name: "externalId",
      type: "text",
      index: true,
      admin: {
        description: "Optional external / IoT / utility account identifier.",
      },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
