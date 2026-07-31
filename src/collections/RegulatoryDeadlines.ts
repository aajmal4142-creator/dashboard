import type { Access, CollectionConfig, Where } from "payload";

import { tenantWrite } from "@/lib/access";
import { accessibleOrgIds } from "@/lib/access/membership";

/**
 * Catalog + per-org regulatory deadlines.
 * Catalog rows (isCatalog) are global templates filtered by applicability rules.
 * Org rows track status for a specific organisation.
 */
const catalogOrTenantRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const ids = await accessibleOrgIds(req);
  const clauses: Where[] = [{ isCatalog: { equals: true } }];
  if (ids.length > 0) {
    clauses.push({ organisation: { in: ids } });
  }
  return { or: clauses };
};

export const RegulatoryDeadlines: CollectionConfig = {
  slug: "regulatory-deadlines",
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "type",
      "dueDate",
      "severity",
      "status",
      "isCatalog",
      "organisation",
    ],
  },
  access: {
    read: catalogOrTenantRead,
    create: tenantWrite("admin"),
    update: tenantWrite("admin"),
    delete: tenantWrite("admin"),
  },
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: false,
      index: true,
      admin: {
        description: "Empty for global catalog templates; set for org-tracked copies.",
      },
    },
    {
      name: "isCatalog",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: {
        description: "Global template — filtered onto orgs via applicability rules.",
      },
    },
    {
      name: "catalogKey",
      type: "text",
      index: true,
      unique: false,
      admin: {
        description:
          "Stable seed key (e.g. csrd-wave2-2028). Used for idempotent seed + org copies.",
      },
    },
    {
      name: "name",
      type: "text",
      required: true,
      admin: { description: "e.g., CSRD Annual Report Filing, BRSR Submission" },
    },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "Other",
      options: [
        { label: "CSRD", value: "CSRD" },
        { label: "ISSB", value: "ISSB" },
        { label: "SBTi", value: "SBTi" },
        { label: "Taxonomy", value: "Taxonomy" },
        { label: "Other", value: "Other" },
      ],
      index: true,
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Full regulation context shown in the detail modal" },
    },
    {
      name: "documentationUrl",
      type: "text",
      admin: { description: "Official documentation / guidance URL" },
    },
    {
      name: "jurisdiction",
      type: "select",
      required: true,
      options: [
        { label: "EU", value: "EU" },
        { label: "India", value: "IN" },
        { label: "UK", value: "GB" },
        { label: "US", value: "US" },
        { label: "Global", value: "GLOBAL" },
        { label: "Other", value: "OTHER" },
      ],
      admin: { description: "ISO country/region code or scope" },
    },
    {
      name: "country",
      type: "text",
      admin: {
        description: "Primary country code (ISO 3166-1 alpha-2) or region label",
      },
    },
    {
      name: "framework",
      type: "select",
      required: true,
      options: [
        { label: "CSRD", value: "CSRD" },
        { label: "ISSB", value: "ISSB" },
        { label: "SBTi", value: "SBTi" },
        { label: "Taxonomy", value: "Taxonomy" },
        { label: "BRSR", value: "BRSR" },
        { label: "GRI", value: "GRI" },
        { label: "SASB", value: "SASB" },
        { label: "TCFD", value: "TCFD" },
        { label: "ISO 14064", value: "ISO14064" },
        { label: "Other", value: "OTHER" },
      ],
    },
    {
      name: "dueDate",
      type: "date",
      required: true,
      admin: {
        description: "Deadline date for this obligation",
        date: { pickerAppearance: "dayOnly" },
      },
      index: true,
    },
    {
      name: "scope",
      type: "select",
      required: true,
      defaultValue: "all",
      options: [
        { label: "All organisations", value: "all" },
        { label: "By industry", value: "industry" },
        { label: "By size", value: "size" },
        { label: "By country", value: "country" },
      ],
      admin: { description: "applies_to dimension for catalog filtering" },
    },
    {
      name: "severity",
      type: "select",
      required: true,
      defaultValue: "medium",
      options: [
        { label: "Critical", value: "critical" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
      ],
      index: true,
    },
    {
      name: "organisationApplicability",
      type: "group",
      admin: {
        description: "Rule-based filter: org size, industry (NACE), country",
      },
      fields: [
        {
          name: "appliesTo",
          type: "select",
          defaultValue: "all",
          options: [
            { label: "All", value: "all" },
            { label: "Industry", value: "industry" },
            { label: "Size", value: "size" },
            { label: "Country", value: "country" },
          ],
        },
        {
          name: "countries",
          type: "array",
          fields: [{ name: "code", type: "text", required: true }],
          admin: { description: "ISO alpha-2 codes when appliesTo=country" },
        },
        {
          name: "industries",
          type: "array",
          fields: [{ name: "nacePrefix", type: "text", required: true }],
          admin: {
            description: "NACE prefixes (e.g. C, K64) when appliesTo=industry",
          },
        },
        {
          name: "minEmployeeCount",
          type: "number",
          min: 0,
          admin: { description: "Inclusive lower bound when appliesTo=size" },
        },
        {
          name: "maxEmployeeCount",
          type: "number",
          min: 0,
          admin: { description: "Inclusive upper bound when appliesTo=size" },
        },
        {
          name: "revenueBands",
          type: "select",
          hasMany: true,
          options: [
            { label: "< €2m", value: "lt_2m" },
            { label: "€2–10m", value: "2_10m" },
            { label: "€10–50m", value: "10_50m" },
            { label: "€50–250m", value: "50_250m" },
            { label: "> €250m", value: "gt_250m" },
          ],
        },
        {
          name: "euOperatingOnly",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "When true, only EU-operating countries (obligations rules set)",
          },
        },
        {
          name: "requireLargeUndertaking",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "When true, require large-undertaking size proxy from obligations rules",
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Missed", value: "missed" },
        // Legacy values retained for existing rows
        { label: "Not Started (legacy)", value: "not_started" },
        { label: "Submitted (legacy)", value: "submitted" },
        { label: "Verified (legacy)", value: "verified" },
        { label: "Overdue (legacy)", value: "overdue" },
      ],
      admin: { description: "Current status of the deadline" },
      index: true,
    },
    {
      name: "prerequisiteTasks",
      type: "array",
      admin: { description: "Pre-requisite checklist items for this deadline" },
      fields: [
        { name: "task", type: "text", required: true },
        {
          name: "done",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Org-copy completion flag" },
        },
      ],
    },
    {
      name: "linkedReport",
      type: "relationship",
      relationTo: "reports",
      admin: {
        description: "Auto-linked report when status changes to submitted/completed",
      },
    },
    {
      name: "completedDate",
      type: "date",
      admin: {
        description: "Date when work on this deadline was completed",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "submittedDate",
      type: "date",
      admin: {
        description: "Date when deadline was officially submitted",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "verifiedDate",
      type: "date",
      admin: {
        description: "Date when deadline was verified/approved",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "verifiedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who verified the deadline completion" },
    },
    {
      name: "colour",
      type: "select",
      defaultValue: "default",
      options: [
        { label: "Green (Done)", value: "green" },
        { label: "Yellow (In Progress)", value: "yellow" },
        { label: "Red (Overdue)", value: "red" },
        { label: "Blue (Upcoming)", value: "blue" },
        { label: "Gray (Not Started)", value: "gray" },
        { label: "Default", value: "default" },
      ],
      admin: { description: "Calendar display color (prefer severity tokens in UI)" },
    },
    {
      name: "notificationsSent",
      type: "array",
      fields: [
        {
          name: "daysUntilDeadline",
          type: "number",
          admin: { description: "e.g., 90, 60, 30, 14, 7" },
        },
        {
          name: "sentAt",
          type: "date",
          admin: { date: { pickerAppearance: "dayOnly" } },
        },
        {
          name: "retryCount",
          type: "number",
          defaultValue: 0,
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "Sent", value: "sent" },
            { label: "Failed", value: "failed" },
            { label: "Bounced", value: "bounced" },
          ],
          defaultValue: "sent",
        },
      ],
      admin: { description: "Email notification history" },
    },
    {
      name: "unsubscribed",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "User has opted out of notifications for this deadline",
      },
    },
    {
      name: "recurrenceRule",
      type: "text",
      admin: {
        description:
          "iCal RRULE for recurring deadlines, e.g., FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=22",
      },
    },
    {
      name: "tags",
      type: "array",
      fields: [{ name: "tag", type: "text" }],
      admin: { description: "Custom tags for filtering" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "Who created this deadline" },
    },
    {
      name: "confirmedAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayOnly" } },
    },
  ],
};
