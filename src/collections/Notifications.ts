import type { Access, CollectionConfig, Where } from "payload";

import { authenticated } from "@/lib/access";

const NOTIFICATION_TYPES = [
  { label: "Datapoint approved", value: "datapoint_approved" },
  { label: "Report ready", value: "report_ready" },
  { label: "Audit complete", value: "audit_complete" },
  { label: "Alert triggered", value: "alert_triggered" },
  { label: "Supplier response", value: "supplier_response" },
  { label: "Request escalated", value: "request_escalated" },
] as const;

/** Own notifications only — never cross-user via Payload access. */
const ownNotification: Access = ({ req }) => {
  if (!req.user) return false;
  const where: Where = { userId: { equals: req.user.id } };
  return where;
};

export const Notifications: CollectionConfig = {
  slug: "notifications",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "type", "isRead", "organisationId", "createdAt"],
  },
  access: {
    read: ownNotification,
    create: authenticated,
    update: ownNotification,
    delete: ownNotification,
  },
  fields: [
    {
      name: "userId",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "organisationId",
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
      options: [...NOTIFICATION_TYPES],
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "message",
      type: "textarea",
      required: true,
    },
    {
      name: "resourceType",
      type: "text",
      required: true,
      admin: {
        description: "e.g. datapoint, report, audit",
      },
    },
    {
      name: "resourceId",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "isRead",
      type: "checkbox",
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      name: "readAt",
      type: "date",
    },
  ],
  timestamps: true,
};
