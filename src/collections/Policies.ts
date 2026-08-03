import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const POLICIES_SLUG = "policies" as const;

/**
 * Organisation policy document registry (climate, travel, supplier code, etc.).
 * Registry only — no AI drafting.
 */
export const Policies: CollectionConfig = {
  slug: POLICIES_SLUG,
  admin: {
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "category",
      "version",
      "status",
      "owner",
      "effectiveDate",
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
      name: "title",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "category",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Climate", value: "climate" },
        { label: "Travel", value: "travel" },
        { label: "Supplier code", value: "supplier_code" },
        { label: "Environment", value: "environment" },
        { label: "Health & safety", value: "health_safety" },
        { label: "Ethics", value: "ethics" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Retired", value: "retired" },
      ],
    },
    {
      name: "version",
      type: "text",
      required: true,
      admin: {
        description: "Document version label (e.g. 1.0, 2024-Q1).",
      },
    },
    {
      name: "owner",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Policy owner name or email (free text).",
      },
    },
    {
      name: "effectiveDate",
      type: "date",
      required: true,
      index: true,
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Date the policy version takes effect.",
      },
    },
    {
      name: "document",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Optional uploaded file via Media. Prefer URL when no upload.",
      },
    },
    {
      name: "documentUrl",
      type: "text",
      admin: {
        description: "Link to the policy document when not stored in Media.",
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
