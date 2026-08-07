import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const DATA_SUBJECT_REQUESTS_SLUG = "data-subject-requests" as const;

/**
 * DPDP / India privacy workflow (Y06) — product beachhead only.
 * Hosting region / Atlas selection is an open decision (§11). Tracking DSRs
 * here does not by itself constitute legal DPDP Act compliance.
 */
export const DataSubjectRequests: CollectionConfig = {
  slug: DATA_SUBJECT_REQUESTS_SLUG,
  admin: {
    useAsTitle: "requesterEmail",
    defaultColumns: [
      "organisation",
      "type",
      "requesterEmail",
      "status",
      "dueAt",
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
      name: "type",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Access", value: "access" },
        { label: "Erasure", value: "erasure" },
        { label: "Correction", value: "correction" },
      ],
      admin: {
        description: "DPDP data principal request type.",
      },
    },
    {
      name: "requesterEmail",
      type: "email",
      required: true,
      index: true,
      admin: { description: "Email of the data principal making the request." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: [
        { label: "Open", value: "open" },
        { label: "In progress", value: "in_progress" },
        { label: "Fulfilled", value: "fulfilled" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Internal notes — how the request was verified / handled." },
    },
    {
      name: "dueAt",
      type: "date",
      index: true,
      admin: { description: "Internal SLA due date for responding to the request." },
    },
    {
      name: "fulfilledAt",
      type: "date",
      admin: {
        readOnly: true,
        description: "Set when an admin marks the request fulfilled.",
      },
    },
    {
      name: "fulfilledBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
};
