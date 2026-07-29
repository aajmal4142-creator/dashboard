import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const COMPLIANCE_HISTORY_SLUG = "compliance-history" as const;

export const ComplianceHistory: CollectionConfig = {
  slug: COMPLIANCE_HISTORY_SLUG,
  admin: {
    useAsTitle: "action",
    defaultColumns: [
      "organisation",
      "compliance",
      "action",
      "actor",
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
      name: "compliance",
      type: "relationship",
      relationTo: "ghg-protocol-compliance",
      required: true,
      index: true,
      admin: { description: "The compliance record this audit log entry relates to" },
    },
    {
      name: "action",
      type: "select",
      required: true,
      options: [
        { label: "Created", value: "created" },
        { label: "Updated", value: "updated" },
        { label: "Checkpoint Verified", value: "checkpoint-verified" },
        { label: "Data Quality Assessed", value: "data-quality-assessed" },
        { label: "Compliance Score Calculated", value: "score-calculated" },
        { label: "Locked", value: "locked" },
        { label: "Unlocked", value: "unlocked" },
        { label: "Report Generated", value: "report-generated" },
        { label: "Evidence Added", value: "evidence-added" },
        { label: "Assurance Sign-off", value: "assurance-sign-off" },
      ],
      index: true,
    },
    {
      name: "actor",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: { description: "User who performed this action" },
    },
    {
      name: "changes",
      type: "textarea",
      required: true,
      admin: {
        description: "JSON snapshot of what changed (immutable record)",
      },
    },
    {
      name: "reason",
      type: "textarea",
      admin: { description: "Why this action was taken" },
    },
    {
      name: "ipAddress",
      type: "text",
      admin: { description: "IP address of the actor (for compliance audit)" },
    },
  ],
  timestamps: true,
};
