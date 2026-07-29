import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SupplierDataSource: CollectionConfig = {
  slug: "supplier-data-sources",
  admin: {
    useAsTitle: "supplier",
    defaultColumns: ["supplier", "metricName", "source", "confidence", "updatedAt"],
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
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      required: true,
      index: true,
    },
    {
      name: "metricName",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Name of the metric (e.g., 'scope1_emissions', 'has_iso14001')",
      },
    },
    {
      name: "value",
      type: "json",
      required: true,
      admin: {
        description: "The metric value (string, number, boolean, or object)",
      },
    },
    {
      name: "source",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Questionnaire", value: "questionnaire" },
        { label: "UN Global Compact", value: "un_gc" },
        { label: "EU ETS Registry", value: "eu_ets" },
        { label: "SEC Filing", value: "sec_filing" },
        { label: "Manual", value: "manual" },
        { label: "Public Report", value: "public_report" },
      ],
    },
    {
      name: "confidence",
      type: "number",
      min: 0,
      max: 100,
      defaultValue: 50,
      admin: {
        description: "Confidence score (0-100): questionnaire=60%, govt=95%, manual=40%",
      },
    },
    {
      name: "sourceUrl",
      type: "text",
      admin: {
        description: "Link to the source document or registry",
      },
    },
    {
      name: "updatedAt",
      type: "date",
      required: true,
      admin: {
        description: "When this data point was last updated",
      },
    },
    {
      name: "expiresAt",
      type: "date",
      admin: {
        description: "Optional expiration date for time-sensitive data (e.g., certifications)",
      },
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description: "Additional context about this data point",
      },
    },
  ],
  indexes: [
    { fields: ["organisation", "supplier"] },
    { fields: ["organisation", "metricName"] },
  ],
};
