import type { CollectionConfig } from "payload";

import { denyAll, tenantRead, tenantWrite } from "@/lib/access";

export const TRUST_CONTROL_EVENTS_SLUG = "trust-control-events" as const;

/**
 * Append-only org control checklist events for the Trust Center.
 * Status transitions are new rows — update/delete denied for everyone.
 */
export const TrustControlEvents: CollectionConfig = {
  slug: TRUST_CONTROL_EVENTS_SLUG,
  admin: {
    useAsTitle: "controlId",
    defaultColumns: ["controlId", "status", "organisation", "createdAt"],
    description: "Append-only Trust Center checklist events. Do not edit or delete rows.",
  },
  access: {
    read: tenantRead,
    create: tenantWrite("admin"),
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: "controlId",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Stable id from lib/trust checklist catalog",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Implemented", value: "implemented" },
        { label: "Not applicable", value: "not_applicable" },
      ],
    },
    {
      name: "note",
      type: "textarea",
      admin: {
        description: "Optional evidence note for this status change",
      },
    },
    {
      name: "actor",
      type: "relationship",
      relationTo: "users",
      required: false,
    },
  ],
  timestamps: true,
};
