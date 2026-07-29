import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const ASSURANCE_ENGAGEMENTS_SLUG = "assurance-engagements" as const;

export const AssuranceEngagements: CollectionConfig = {
  slug: ASSURANCE_ENGAGEMENTS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "organisation",
      "reportingPeriod",
      "provider",
      "scope",
      "status",
      "requestedAt",
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
      name: "provider",
      type: "group",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          admin: { description: "Assurance provider name" },
        },
        {
          name: "email",
          type: "email",
          required: true,
          admin: { description: "Primary contact email" },
        },
        {
          name: "contactPerson",
          type: "text",
          admin: { description: "Primary contact name" },
        },
        {
          name: "providerOrg",
          type: "text",
          admin: { description: "Provider organization name" },
        },
      ],
    },
    {
      name: "scope",
      type: "select",
      required: true,
      options: [
        { label: "Scope 1", value: "scope1" },
        { label: "Scope 2", value: "scope2" },
        { label: "Scope 3", value: "scope3" },
        { label: "All Scopes", value: "all" },
      ],
      index: true,
    },
    {
      name: "framework",
      type: "select",
      options: [
        { label: "CSRD", value: "csrd" },
        { label: "BRSR", value: "brsr" },
        { label: "GRI", value: "gri" },
        { label: "SASB", value: "sasb" },
      ],
      admin: { description: "Optional framework focus" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Reviewing", value: "reviewing" },
        { label: "Findings Submitted", value: "findings_submitted" },
        { label: "Approved", value: "approved" },
        { label: "Signed Off", value: "signed_off" },
      ],
      index: true,
    },
    {
      name: "requestedAt",
      type: "date",
      required: true,
      admin: { description: "When engagement was requested" },
    },
    {
      name: "submittedAt",
      type: "date",
      admin: { description: "When engagement was formally submitted to provider" },
    },
    {
      name: "approvedAt",
      type: "date",
      admin: { description: "When findings were approved by organization" },
    },
    {
      name: "signedOffAt",
      type: "date",
      admin: { description: "When provider signed off on assurance" },
    },
    {
      name: "dataGaps",
      type: "array",
      fields: [
        {
          name: "metric",
          type: "text",
          required: true,
          admin: { description: "Missing metric or data point" },
        },
        {
          name: "severity",
          type: "select",
          required: true,
          options: [
            { label: "High", value: "high" },
            { label: "Medium", value: "medium" },
            { label: "Low", value: "low" },
          ],
        },
        {
          name: "description",
          type: "textarea",
          required: true,
          admin: { description: "Why this metric is missing or incomplete" },
        },
      ],
      admin: { description: "Data gaps identified for this engagement" },
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Internal notes about engagement" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who created engagement" },
    },
    {
      name: "assignedTo",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "Provider user assigned to this engagement (external user)",
      },
    },
  ],
};
