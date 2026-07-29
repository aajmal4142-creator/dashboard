import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";
import { ASSURANCE_ENGAGEMENTS_SLUG } from "./AssuranceEngagements";

export const VERIFICATION_FINDINGS_SLUG = "verification-findings" as const;

export const VerificationFindings: CollectionConfig = {
  slug: VERIFICATION_FINDINGS_SLUG,
  admin: {
    useAsTitle: "title",
    defaultColumns: [
      "engagement",
      "title",
      "severity",
      "category",
      "status",
      "submittedAt",
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
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Data Quality", value: "data-quality" },
        { label: "Methodology", value: "methodology" },
        { label: "Scope", value: "scope" },
        { label: "Calculation", value: "calculation" },
        { label: "Completeness", value: "completeness" },
        { label: "Other", value: "other" },
      ],
      index: true,
      admin: { description: "Type of finding" },
    },
    {
      name: "severity",
      type: "select",
      required: true,
      options: [
        { label: "Critical", value: "critical" },
        { label: "Major", value: "major" },
        { label: "Minor", value: "minor" },
        { label: "Info", value: "info" },
      ],
      index: true,
    },
    {
      name: "title",
      type: "text",
      required: true,
      admin: { description: "Brief finding title" },
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      admin: { description: "Detailed description of finding" },
    },
    {
      name: "affectedMetric",
      type: "text",
      admin: { description: "Which metric/datapoint this affects" },
    },
    {
      name: "evidence",
      type: "array",
      fields: [
        {
          name: "url",
          type: "text",
          admin: { description: "URL or reference to evidence" },
        },
        {
          name: "description",
          type: "textarea",
          admin: { description: "How this supports the finding" },
        },
      ],
      admin: { description: "Supporting evidence links/references" },
    },
    {
      name: "impact",
      type: "select",
      options: [
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      admin: { description: "Business impact of this finding" },
    },
    {
      name: "recommendation",
      type: "textarea",
      admin: { description: "Recommended action/resolution" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Acknowledged", value: "acknowledged" },
        { label: "Resolved", value: "resolved" },
        { label: "Closed", value: "closed" },
      ],
      index: true,
    },
    {
      name: "submittedBy",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: { description: "Provider user who submitted this finding" },
    },
    {
      name: "submittedAt",
      type: "date",
      required: true,
      admin: { description: "When finding was submitted" },
    },
    {
      name: "resolvedAt",
      type: "date",
      admin: { description: "When finding was resolved" },
    },
    {
      name: "resolutionNotes",
      type: "textarea",
      admin: { description: "Notes on how finding was resolved" },
    },
  ],
};
