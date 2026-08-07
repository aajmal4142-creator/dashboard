import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

/**
 * One row per (organisation, GHG Protocol Scope 3 category 1–15) —
 * the org's inclusion/exclusion decision + rationale. Feature Y01.
 * Missing rows mean "not assessed" — never silently included/excluded;
 * see lib/scope3/boundary.ts for the merge with the canonical catalog.
 */
export const SCOPE3_BOUNDARIES_SLUG = "scope3-boundaries" as const;

export const Scope3Boundaries: CollectionConfig = {
  slug: SCOPE3_BOUNDARIES_SLUG,
  admin: {
    useAsTitle: "category",
    defaultColumns: ["organisation", "category", "status", "updatedAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "category",
      type: "number",
      required: true,
      min: 1,
      max: 15,
      index: true,
      admin: {
        description: "GHG Protocol Scope 3 category number (1–15).",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "not_assessed",
      options: [
        { label: "Included", value: "included" },
        { label: "Excluded", value: "excluded" },
        { label: "Not assessed", value: "not_assessed" },
      ],
    },
    {
      name: "rationale",
      type: "textarea",
      admin: {
        description:
          "Why this category is included/excluded — required for audit trail on exclusions.",
      },
    },
  ],
  timestamps: true,
};
