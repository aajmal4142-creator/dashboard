import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const ComplianceTargets: CollectionConfig = {
  slug: "compliance-targets",
  admin: {
    useAsTitle: "framework",
    defaultColumns: [
      "organisation",
      "framework",
      "metricKey",
      "targetValue",
      "baselineYear",
      "targetYear",
      "status",
      "createdAt",
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
      admin: {
        description: "Reference to FrameworkMetrics.metricKey",
      },
    },
    {
      name: "metricLabel",
      type: "text",
      required: false,
      admin: {
        description: "Cached metric label for readability",
      },
    },
    {
      name: "targetValue",
      type: "number",
      required: true,
      admin: {
        description: "Target value for this metric",
      },
    },
    {
      name: "baselineYear",
      type: "number",
      required: true,
      admin: {
        description: "Year from which emissions are measured",
      },
    },
    {
      name: "targetYear",
      type: "number",
      required: true,
      admin: {
        description: "Year by which target should be achieved",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "On Track", value: "on-track" },
        { label: "At Risk", value: "at-risk" },
        { label: "Off Track", value: "off-track" },
      ],
      admin: {
        description: "Current status relative to trajectory",
      },
    },
    {
      name: "notes",
      type: "richText",
      admin: {
        description: "Internal notes about this target",
      },
    },
    {
      name: "approvalStatus",
      type: "select",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ],
      defaultValue: "draft",
      admin: {
        description: "Approval workflow status",
      },
    },
  ],
};
