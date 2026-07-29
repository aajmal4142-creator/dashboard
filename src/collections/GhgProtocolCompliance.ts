import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const GHG_PROTOCOL_COMPLIANCE_SLUG = "ghg-protocol-compliance" as const;

export const GhgProtocolCompliance: CollectionConfig = {
  slug: GHG_PROTOCOL_COMPLIANCE_SLUG,
  admin: {
    useAsTitle: "complianceYear",
    defaultColumns: [
      "organisation",
      "complianceYear",
      "scope1Total",
      "scope2Total",
      "scope3Total",
      "complianceScore",
      "isVerified",
      "verifiedAt",
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
      name: "complianceYear",
      type: "text",
      required: true,
      admin: { description: "e.g. 2024, 2025" },
    },
    {
      name: "scope1Total",
      type: "number",
      required: true,
      admin: { description: "Total Scope 1 emissions (tCO2e)" },
    },
    {
      name: "scope2Total",
      type: "number",
      required: true,
      admin: { description: "Total Scope 2 emissions (tCO2e)" },
    },
    {
      name: "scope3Total",
      type: "number",
      required: true,
      admin: { description: "Total Scope 3 emissions (tCO2e)" },
    },
    {
      name: "boundaryDefinition",
      type: "textarea",
      required: true,
      admin: {
        description: "Organizational and operational boundaries defined",
      },
    },
    {
      name: "methodology",
      type: "textarea",
      required: true,
      admin: { description: "Emissions calculation methodology used" },
    },
    {
      name: "dataQualityScore",
      type: "number",
      required: true,
      admin: { description: "Data quality assessment (0-100)" },
    },
    {
      name: "dataQualityBreakdown",
      type: "group",
      fields: [
        {
          name: "completeness",
          type: "number",
          admin: { description: "Completeness score (0-100)" },
        },
        {
          name: "accuracy",
          type: "number",
          admin: { description: "Accuracy score (0-100)" },
        },
        {
          name: "consistency",
          type: "number",
          admin: { description: "Consistency score (0-100)" },
        },
        {
          name: "recency",
          type: "number",
          admin: { description: "Recency score (0-100)" },
        },
      ],
    },
    {
      name: "complianceScore",
      type: "number",
      required: true,
      admin: { description: "Overall compliance score (0-100)" },
    },
    {
      name: "isVerified",
      type: "checkbox",
      required: true,
      defaultValue: false,
      admin: { description: "Has this compliance been verified?" },
    },
    {
      name: "isLocked",
      type: "checkbox",
      required: true,
      defaultValue: false,
      admin: {
        description: "Locked after assurance auditor sign-off (immutable)",
      },
    },
    {
      name: "verifiedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who verified this compliance" },
    },
    {
      name: "verifiedAt",
      type: "date",
      admin: { description: "When verification occurred" },
    },
    {
      name: "lockedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "Assurance auditor who locked this" },
    },
    {
      name: "lockedAt",
      type: "date",
      admin: { description: "When this was locked for audit" },
    },
    {
      name: "checkpointsFulfilled",
      type: "number",
      admin: { description: "Number of fulfilled checkpoints" },
    },
    {
      name: "checkpointsTotal",
      type: "number",
      admin: { description: "Total checkpoints in compliance framework" },
    },
  ],
  timestamps: true,
};
