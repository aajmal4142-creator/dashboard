import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const Scope3Activities: CollectionConfig = {
  slug: "scope3-activities",
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "source.name",
      "period",
      "calculatedEmissions",
      "status",
      "createdAt",
    ],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  indexes: [
    {
      fields: ["organisation", "source", "period"],
    },
    {
      fields: ["organisation", "status"],
    },
    {
      fields: ["createdAt"],
    },
  ],
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "source",
      type: "relationship",
      relationTo: "scope3-sources",
      required: true,
    },
    {
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
    },
    {
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      index: true,
      admin: {
        description: "Linked supplier when this activity is Category 1 purchased goods",
      },
    },
    {
      name: "supplyTier",
      type: "number",
      min: 1,
      max: 3,
      admin: {
        description:
          "Supply-chain tier (1|2|3) for Category 1 breakdown — avoids double-count",
      },
    },
    {
      name: "activityData",
      type: "json",
      required: true,
      admin: {
        description: "JSON object with activity field values",
      },
    },
    {
      name: "calculatedEmissions",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Calculated tonnes CO2e (readonly, auto-calculated)",
        readOnly: true,
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      required: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Validated", value: "validated" },
        { label: "Approved", value: "approved" },
      ],
    },
    {
      name: "evidence",
      type: "relationship",
      relationTo: "evidence",
      hasMany: true,
      admin: {
        description: "Supporting documents for audit trail",
      },
    },
    {
      name: "enteredBy",
      type: "relationship",
      relationTo: "users",
      admin: {
        readOnly: true,
        description: "User who created this activity",
      },
    },
    {
      name: "approvedBy",
      type: "relationship",
      relationTo: "users",
      admin: {
        readOnly: true,
        description: "User who approved this activity",
      },
    },
    {
      name: "approvedAt",
      type: "date",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "validationNotes",
      type: "textarea",
      admin: {
        description: "Notes from validation process",
      },
    },
  ],
};
