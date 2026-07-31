import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ISO_14064_COMPLIANCE_SLUG = "iso-14064-compliance" as const;

/**
 * Per-organisation ISO 14064 Part 1 / Part 2 certification checklist.
 * Checklist rows are copied from the seed catalog on create — never hardcoded in UI.
 */
export const ISO14064Compliance: CollectionConfig = {
  slug: ISO_14064_COMPLIANCE_SLUG,
  admin: {
    useAsTitle: "organisation",
    defaultColumns: [
      "organisation",
      "status",
      "complianceScore",
      "verifierAssigned",
      "nextReviewDate",
    ],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
      ],
      index: true,
    },
    {
      name: "sections",
      type: "array",
      labels: { singular: "Requirement", plural: "Requirements" },
      admin: {
        description:
          "ISO 14064-1 (org) and 14064-2 (project) checklist rows seeded on create.",
      },
      fields: [
        {
          name: "itemKey",
          type: "text",
          required: true,
          admin: {
            description: "Stable seed key (e.g. p1-01). Used for updates.",
          },
        },
        {
          name: "sectionNumber",
          type: "text",
          required: true,
          admin: { description: "Display section number (e.g. 1.1, 2.3)" },
        },
        {
          name: "part",
          type: "select",
          required: true,
          options: [
            { label: "Part 1 — Organisation", value: "part1" },
            { label: "Part 2 — Project", value: "part2" },
          ],
        },
        {
          name: "requirement",
          type: "text",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
        },
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "not_started",
          options: [
            { label: "Not Started", value: "not_started" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "N/A", value: "na" },
          ],
        },
        {
          name: "evidenceIds",
          type: "relationship",
          relationTo: "evidence",
          hasMany: true,
          admin: {
            description: "At least one evidence link is required to mark completed.",
          },
        },
        {
          name: "notes",
          type: "textarea",
        },
        {
          name: "completedAt",
          type: "date",
        },
        {
          name: "autoLinkHint",
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "CSRD / report", value: "csrd_report" },
            { label: "Activity datapoints", value: "datapoints" },
            { label: "Audit logs", value: "audit_logs" },
            { label: "Emission factors", value: "emission_factors" },
          ],
          defaultValue: "none",
          admin: {
            description: "Hint for evidence auto-suggest in the UI.",
          },
        },
      ],
    },
    {
      name: "verifierAssigned",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "Third-party auditor / verifier (org membership user).",
      },
    },
    {
      name: "assurancePartner",
      type: "relationship",
      relationTo: "assurance-partners",
      admin: {
        description: "Optional linked assurance firm from the partner directory.",
      },
    },
    {
      name: "lastReviewDate",
      type: "date",
    },
    {
      name: "nextReviewDate",
      type: "date",
    },
    {
      name: "complianceScore",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: {
        description: "Percent of applicable items completed (0–100).",
        readOnly: true,
      },
    },
    {
      name: "verifierNoticeSentAt",
      type: "date",
      admin: { description: "When the last verifier assignment notice was sent." },
    },
  ],
};
