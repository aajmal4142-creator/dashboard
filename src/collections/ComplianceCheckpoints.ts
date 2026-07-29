import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const COMPLIANCE_CHECKPOINTS_SLUG = "compliance-checkpoints" as const;

export const ComplianceCheckpoints: CollectionConfig = {
  slug: COMPLIANCE_CHECKPOINTS_SLUG,
  admin: {
    useAsTitle: "requirementName",
    defaultColumns: [
      "organisation",
      "checkpointId",
      "category",
      "requirementName",
      "status",
      "verifiedBy",
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
      name: "ghgProtocolCompliance",
      type: "relationship",
      relationTo: "ghg-protocol-compliance",
      required: true,
      index: true,
      admin: { description: "Parent compliance record" },
    },
    {
      name: "checkpointId",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Unique checkpoint identifier (e.g., GHG-001)" },
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Scope Boundaries", value: "scope-boundaries" },
        { label: "Data Collection", value: "data-collection" },
        { label: "Calculation Methods", value: "calculation-methods" },
        { label: "Emission Factors", value: "emission-factors" },
        { label: "Quality Assurance", value: "quality-assurance" },
        { label: "Documentation", value: "documentation" },
        { label: "Organizational Boundaries", value: "organizational-boundaries" },
        { label: "Operational Boundaries", value: "operational-boundaries" },
        { label: "Restatements", value: "restatements" },
        { label: "Uncertainty", value: "uncertainty" },
      ],
      index: true,
    },
    {
      name: "requirementName",
      type: "text",
      required: true,
      admin: { description: "Human-readable requirement name" },
    },
    {
      name: "requirementCode",
      type: "text",
      required: true,
      admin: {
        description:
          "GHG Protocol section/subsection (e.g., Section 4.2.3)",
      },
    },
    {
      name: "requirementText",
      type: "textarea",
      required: true,
      admin: { description: "Full requirement text from GHG Protocol" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "not-started",
      options: [
        { label: "Not Started", value: "not-started" },
        { label: "In Progress", value: "in-progress" },
        { label: "Completed", value: "completed" },
        { label: "Verified", value: "verified" },
        { label: "Waived", value: "waived" },
      ],
      index: true,
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Internal notes or implementation details" },
    },
    {
      name: "evidenceLinks",
      type: "array",
      fields: [
        {
          name: "url",
          type: "text",
          admin: {
            description: "URL or reference to supporting evidence",
          },
        },
        {
          name: "documentType",
          type: "select",
          options: [
            { label: "Data Source", value: "data-source" },
            { label: "Calculation Sheet", value: "calculation-sheet" },
            { label: "Policy Document", value: "policy-document" },
            { label: "Audit Report", value: "audit-report" },
            { label: "Third-party Verification", value: "third-party" },
            { label: "Other", value: "other" },
          ],
        },
        {
          name: "description",
          type: "textarea",
          admin: { description: "How this evidence supports the requirement" },
        },
      ],
      admin: { description: "Supporting evidence and documentation" },
    },
    {
      name: "verifiedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who verified this checkpoint" },
    },
    {
      name: "verifiedAt",
      type: "date",
      admin: { description: "When checkpoint was verified" },
    },
    {
      name: "applicableScopes",
      type: "select",
      hasMany: true,
      options: [
        { label: "Scope 1", value: "scope1" },
        { label: "Scope 2", value: "scope2" },
        { label: "Scope 3", value: "scope3" },
      ],
      admin: { description: "Which emission scopes this applies to" },
    },
    {
      name: "waiverReason",
      type: "textarea",
      admin: {
        description: "If waived, explain why this requirement is not applicable",
      },
    },
  ],
  timestamps: true,
};
