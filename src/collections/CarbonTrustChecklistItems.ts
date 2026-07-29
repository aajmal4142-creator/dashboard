import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const CARBON_TRUST_CHECKLIST_ITEMS_SLUG = "carbon-trust-checklist-items" as const;

export const CarbonTrustChecklistItems: CollectionConfig = {
  slug: CARBON_TRUST_CHECKLIST_ITEMS_SLUG,
  admin: {
    useAsTitle: "requirementName",
    defaultColumns: ["certification", "requirementName", "status", "createdAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "certification",
      type: "relationship",
      relationTo: "carbon-trust-certifications",
      required: true,
      index: true,
    },
    {
      name: "requirementId",
      type: "text",
      required: true,
      admin: { description: "Unique requirement identifier (e.g., CT-REQ-001)" },
    },
    {
      name: "requirementName",
      type: "text",
      required: true,
      admin: { description: "Name of the requirement" },
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      admin: { description: "Detailed description of what's required" },
    },
    {
      name: "evidenceRequired",
      type: "textarea",
      admin: {
        description: "Types of evidence needed (e.g., reports, invoices, calculations)",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Submitted", value: "submitted" },
        { label: "Additional Info Requested", value: "additional_info_requested" },
        { label: "Approved", value: "approved" },
        { label: "Not Applicable", value: "not_applicable" },
      ],
      index: true,
    },
    {
      name: "response",
      type: "textarea",
      admin: { description: "Organization's response/evidence description" },
    },
    {
      name: "attachedDocuments",
      type: "relationship",
      relationTo: "carbon-trust-documents",
      hasMany: true,
      admin: { description: "Evidence documents linked to this requirement" },
    },
    {
      name: "auditorFeedback",
      type: "textarea",
      admin: { description: "Auditor comments or requested changes" },
    },
    {
      name: "auditorApprovedAt",
      type: "date",
      admin: { description: "When auditor approved this item" },
    },
    {
      name: "severity",
      type: "select",
      options: [
        { label: "Critical", value: "critical" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      admin: { description: "Importance level of this requirement" },
    },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Governance", value: "governance" },
        { label: "Emissions Measurement", value: "emissions_measurement" },
        { label: "Data Management", value: "data_management" },
        { label: "Reporting", value: "reporting" },
        { label: "Verification", value: "verification" },
        { label: "Documentation", value: "documentation" },
      ],
      admin: { description: "Requirement category" },
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Internal notes" },
    },
  ],
  timestamps: true,
};
