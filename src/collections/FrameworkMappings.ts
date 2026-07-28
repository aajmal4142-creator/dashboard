import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const FrameworkMappings: CollectionConfig = {
  slug: "framework-mappings",
  admin: {
    useAsTitle: "framework",
    defaultColumns: [
      "organisation",
      "framework",
      "period",
      "complianceStatus",
      "calculatedAt",
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
    },
    {
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
      admin: {
        description: "Reporting period for this mapping",
      },
    },
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
      name: "emissionsData",
      type: "json",
      required: true,
      admin: {
        description:
          "Emissions snapshot: scope1 (number), scope2 (number), scope3 (number), total (number)",
      },
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        description:
          "Additional context: revenue (number), employees (number), units (number), currency (string), etc.",
      },
    },
    {
      name: "metrics",
      type: "json",
      required: true,
      admin: {
        description:
          "Array of calculated metrics: metricKey (string), value (number), unit (string), confidence (high/medium/low), calculatedAt (ISO string)",
      },
    },
    {
      name: "complianceStatus",
      type: "text",
      admin: {
        description: "Compliance status summary (compliant, partial, non-compliant)",
      },
    },
    {
      name: "dataGaps",
      type: "json",
      admin: {
        description:
          "Array of identified gaps: metricKey (string), label (string), impact (high/medium/low), estimatedImpactOnScore (number)",
      },
    },
    {
      name: "anomalies",
      type: "json",
      admin: {
        description:
          "Array of detected anomalies: metricKey (string), value (number), expected (number), deviation (number), severity (low/medium/high)",
      },
    },
    {
      name: "confidenceLevel",
      type: "number",
      admin: {
        description: "Overall confidence in this mapping (0-100)",
      },
    },
    {
      name: "calculatedAt",
      type: "date",
      required: true,
      admin: {
        description: "When this mapping was calculated",
      },
    },
    {
      name: "calculatedBy",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "User who triggered the calculation",
      },
    },
  ],
};
