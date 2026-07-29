import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const ISO_14064_COMPLIANCE_SLUG = "iso-14064-compliance" as const;

export const ISO14064Compliance: CollectionConfig = {
  slug: ISO_14064_COMPLIANCE_SLUG,
  admin: {
    useAsTitle: "organisation",
    defaultColumns: ["organisation", "status", "complianceScore", "lastAuditDate"],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      defaultValue: "not_started",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Pending Review", value: "pending_review" },
        { label: "Verified", value: "verified" },
        { label: "Non-Compliant", value: "non_compliant" },
      ],
      index: true,
    },
    {
      name: "checklist",
      type: "array",
      fields: [
        {
          name: "requirement",
          type: "text",
          required: true,
          admin: { description: "ISO 14064-1 requirement" },
        },
        {
          name: "description",
          type: "textarea",
          admin: { description: "Detailed requirement description" },
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "Not Started", value: "not_started" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "N/A", value: "na" },
          ],
          defaultValue: "not_started",
        },
        {
          name: "evidence",
          type: "array",
          fields: [
            {
              name: "document",
              type: "relationship",
              relationTo: "media",
            },
            {
              name: "description",
              type: "text",
            },
            {
              name: "uploadedAt",
              type: "date",
            },
          ],
        },
        {
          name: "assignedTo",
          type: "relationship",
          relationTo: "users",
        },
        {
          name: "dueDate",
          type: "date",
        },
        {
          name: "completedAt",
          type: "date",
        },
        {
          name: "notes",
          type: "textarea",
        },
      ],
    },
    {
      name: "complianceScore",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: { description: "Compliance score percentage (0-100)" },
    },
    {
      name: "gaps",
      type: "array",
      fields: [
        {
          name: "gap",
          type: "text",
          required: true,
        },
        {
          name: "severity",
          type: "select",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
          ],
        },
        {
          name: "remediationPlan",
          type: "textarea",
        },
      ],
    },
    {
      name: "auditor",
      type: "relationship",
      relationTo: "users",
      admin: { description: "Assigned auditor/reviewer" },
    },
    {
      name: "lastAuditDate",
      type: "date",
      admin: { description: "Date of last audit" },
    },
    {
      name: "nextAuditDate",
      type: "date",
      admin: { description: "Scheduled next audit" },
    },
    {
      name: "auditReport",
      type: "relationship",
      relationTo: "media",
      admin: { description: "Final audit report document" },
    },
    {
      name: "verificationNotes",
      type: "textarea",
      admin: { description: "Auditor verification notes" },
    },
  ],
};
