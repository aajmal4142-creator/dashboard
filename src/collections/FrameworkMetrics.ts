import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const FrameworkMetrics: CollectionConfig = {
  slug: "framework-metrics",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["framework", "metricKey", "label", "unit", "required", "createdAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "framework",
      type: "select",
      required: true,
      options: [
        { label: "CSRD", value: "csrd" },
        { label: "BRSR", value: "brsr" },
        { label: "GRI", value: "gri" },
        { label: "SASB", value: "sasb" },
      ],
      index: true,
    },
    {
      name: "metricKey",
      type: "text",
      required: true,
      index: true,
      admin: {
        description:
          "Unique identifier, e.g., csrd_scope1_intensity, brsr_total_emissions",
      },
    },
    {
      name: "label",
      type: "text",
      required: true,
      admin: {
        description: "Human-readable metric name",
      },
    },
    {
      name: "unit",
      type: "text",
      required: true,
      admin: {
        description: "Unit of measurement, e.g., tCO2e, tCO2e/€M revenue, kg CO2e/unit",
      },
    },
    {
      name: "description",
      type: "richText",
      admin: {
        description: "Detailed metric definition and calculation methodology",
      },
    },
    {
      name: "dataType",
      type: "select",
      required: true,
      options: [
        { label: "Emissions", value: "emissions" },
        { label: "Intensity", value: "intensity" },
        { label: "Percentage", value: "percentage" },
        { label: "Custom", value: "custom" },
      ],
      admin: {
        description: "Type of data this metric represents",
      },
    },
    {
      name: "required",
      type: "checkbox",
      required: true,
      defaultValue: true,
      admin: {
        description: "Whether this metric is required for framework compliance",
      },
    },
    {
      name: "calculationMethod",
      type: "json",
      admin: {
        description:
          "Calculation details: formula (string), dependencies (string[]), parameters (object)",
      },
    },
  ],
};
