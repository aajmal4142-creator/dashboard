import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";
import { ASSURANCE_ENGAGEMENTS_SLUG } from "./AssuranceEngagements";

export const ASSURANCE_REPORTS_SLUG = "assurance-reports" as const;

export const AssuranceReports: CollectionConfig = {
  slug: ASSURANCE_REPORTS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "engagement",
      "organisation",
      "reportingPeriod",
      "assuranceLevel",
      "status",
      "generatedAt",
      "publishedAt",
      "createdAt",
    ],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "engagement",
      type: "relationship",
      relationTo: ASSURANCE_ENGAGEMENTS_SLUG as any,
      required: true,
      index: true,
      admin: { description: "Associated assurance engagement" },
    },
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
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Approved", value: "approved" },
        { label: "Published", value: "published" },
      ],
      index: true,
    },
    {
      name: "assuranceLevel",
      type: "select",
      required: true,
      options: [
        { label: "Limited", value: "limited" },
        { label: "Reasonable", value: "reasonable" },
      ],
      admin: {
        description: "Audit standard assurance level (limited vs reasonable)",
      },
    },
    {
      name: "assuranceStatement",
      type: "textarea",
      required: true,
      admin: {
        description: "Formal assurance statement text to be published",
      },
    },
    {
      name: "executiveSummary",
      type: "textarea",
      admin: {
        description: "High-level summary for stakeholders",
      },
    },
    {
      name: "findingsSummary",
      type: "group",
      fields: [
        {
          name: "total",
          type: "number",
          required: true,
          defaultValue: 0,
        },
        {
          name: "critical",
          type: "number",
          required: true,
          defaultValue: 0,
        },
        {
          name: "major",
          type: "number",
          required: true,
          defaultValue: 0,
        },
        {
          name: "minor",
          type: "number",
          required: true,
          defaultValue: 0,
        },
        {
          name: "info",
          type: "number",
          required: true,
          defaultValue: 0,
        },
      ],
      admin: { description: "Count of findings by severity" },
    },
    {
      name: "provider",
      type: "group",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          admin: { description: "Provider organization name" },
        },
        {
          name: "credentials",
          type: "text",
          admin: { description: "Provider credentials/certifications" },
        },
        {
          name: "signatureDate",
          type: "date",
          required: true,
          admin: { description: "Date of provider signature" },
        },
        {
          name: "signatureName",
          type: "text",
          required: true,
          admin: { description: "Name of signatory from provider" },
        },
      ],
      admin: { description: "Provider sign-off information" },
    },
    {
      name: "generatedAt",
      type: "date",
      required: true,
      admin: { description: "When report was initially generated" },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: { description: "When report was published" },
    },
    {
      name: "publishedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who published the report" },
    },
    {
      name: "dataGapsSummary",
      type: "array",
      fields: [
        {
          name: "metric",
          type: "text",
          required: true,
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
          name: "resolution",
          type: "text",
          admin: { description: "How data gap was addressed" },
        },
      ],
      admin: { description: "Summary of data gaps identified and addressed" },
    },
    {
      name: "assuranceScore",
      type: "number",
      min: 0,
      max: 100,
      admin: {
        description: "Overall assurance confidence score (0-100)",
      },
    },
    {
      name: "pdf",
      type: "upload",
      relationTo: "media",
      admin: { description: "Generated PDF report (if exported)" },
    },
  ],
};
