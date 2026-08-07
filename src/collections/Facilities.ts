import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const FACILITIES_SLUG = "facilities" as const;

/**
 * Operational sites / facilities for an organisation.
 * Distinct from legal-entity org hierarchy (`parentOrganisation` consolidation).
 */
export const Facilities: CollectionConfig = {
  slug: FACILITIES_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "code", "facilityType", "country", "active", "updatedAt"],
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
      name: "code",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Short site code unique within the organisation (e.g. LON-HQ).",
      },
    },
    {
      name: "facilityType",
      type: "select",
      required: true,
      defaultValue: "other",
      index: true,
      options: [
        { label: "Office", value: "office" },
        { label: "Plant", value: "plant" },
        { label: "Warehouse", value: "warehouse" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "country",
      type: "text",
      admin: {
        description: "ISO 3166-1 alpha-2 when known.",
      },
    },
    {
      name: "region",
      type: "text",
      admin: { description: "State, province, or free-text region." },
    },
    {
      name: "address",
      type: "textarea",
      admin: { description: "Optional street address." },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
    },
    {
      name: "openSupplyHubId",
      type: "text",
      index: true,
      admin: {
        description:
          "Open Supply Hub OS ID (e.g. US2021250D1DTN7). Links to the public facility profile at opensupplyhub.org — operator-entered, never inferred.",
      },
    },
    {
      name: "parentFacility",
      type: "relationship",
      relationTo: FACILITIES_SLUG,
      index: true,
      admin: {
        description:
          "Optional parent site for operational hierarchy (campus → building). Not legal consolidation.",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
