import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const CARBON_TRUST_CERTIFICATIONS_SLUG = "carbon-trust-certifications" as const;

export const CarbonTrustCertifications: CollectionConfig = {
  slug: CARBON_TRUST_CERTIFICATIONS_SLUG,
  admin: {
    useAsTitle: "certificationId",
    defaultColumns: [
      "organisation",
      "reportingPeriod",
      "status",
      "completionPercentage",
      "submittedAt",
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
      name: "reportingPeriod",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
    },
    {
      name: "certificationId",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Unique certification identifier (e.g., CT-2024-001)" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Under Review", value: "under_review" },
        { label: "Additional Info Requested", value: "additional_info_requested" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
        { label: "Certified", value: "certified" },
        { label: "Expired", value: "expired" },
      ],
      index: true,
    },
    {
      name: "completionPercentage",
      type: "number",
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: { description: "Overall checklist completion %" },
    },
    {
      name: "validityPeriod",
      type: "group",
      fields: [
        {
          name: "issuedAt",
          type: "date",
          admin: { description: "When certification was issued" },
        },
        {
          name: "expiresAt",
          type: "date",
          admin: { description: "When certification expires (3 years from issued)" },
        },
        {
          name: "reminderSentAt",
          type: "date",
          admin: { description: "When renewal reminder was sent (at 2yr 9m)" },
        },
      ],
    },
    {
      name: "auditor",
      type: "group",
      fields: [
        {
          name: "name",
          type: "text",
          admin: { description: "Assigned auditor name" },
        },
        {
          name: "email",
          type: "email",
          admin: { description: "Auditor contact email" },
        },
        {
          name: "organisation",
          type: "text",
          admin: { description: "Auditor organisation" },
        },
        {
          name: "userId",
          type: "relationship",
          relationTo: "users",
          admin: { description: "Associated Payload user account" },
        },
      ],
    },
    {
      name: "submittedAt",
      type: "date",
      admin: { description: "When certification was submitted for review" },
    },
    {
      name: "approvedAt",
      type: "date",
      admin: { description: "When organization approved findings" },
    },
    {
      name: "reviewNotes",
      type: "textarea",
      admin: { description: "Auditor review notes and feedback" },
    },
    {
      name: "rejectionReason",
      type: "textarea",
      admin: { description: "Reason for rejection if applicable" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who initiated certification" },
    },
  ],
  timestamps: true,
};
