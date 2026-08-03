import type { CollectionConfig } from "payload";

import { accessibleOrgIds } from "@/lib/access/membership";

export const TEAMS_INTEGRATIONS_SLUG = "teams-integrations" as const;

export const TeamsIntegrations: CollectionConfig = {
  slug: TEAMS_INTEGRATIONS_SLUG,
  admin: {
    useAsTitle: "channelLabel",
    defaultColumns: ["channelLabel", "status", "enabled", "connectedAt"],
  },
  access: {
    read: async ({ req }) => {
      if (!req.user) return false;
      const ids = await accessibleOrgIds(req);
      if (ids.length === 0) return false;
      return { organisationId: { in: ids } };
    },
    create: async ({ req }) => Boolean(req.user),
    update: async ({ req }) => {
      if (!req.user) return false;
      const ids = await accessibleOrgIds(req);
      if (ids.length === 0) return false;
      return { organisationId: { in: ids } };
    },
    delete: async ({ req }) => {
      if (!req.user) return false;
      const ids = await accessibleOrgIds(req);
      if (ids.length === 0) return false;
      return { organisationId: { in: ids } };
    },
  },
  fields: [
    {
      name: "organisationId",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "disconnected",
      options: [
        { label: "Connected", value: "connected" },
        { label: "Disconnected", value: "disconnected" },
        { label: "Failed", value: "failed" },
      ],
      index: true,
    },
    {
      name: "enabled",
      type: "checkbox",
      required: true,
      defaultValue: true,
      admin: {
        description: "When off, alert posts are skipped without clearing the webhook.",
      },
    },
    {
      name: "webhookUrl",
      type: "text",
      admin: {
        description: "Incoming Webhook URL (AES-256-GCM encrypted at rest)",
        readOnly: true,
      },
    },
    {
      name: "channelLabel",
      type: "text",
      admin: {
        description: "Optional display label for the Teams channel",
      },
    },
    {
      name: "connectedAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "connectedBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
    {
      name: "lastTestedAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "lastError",
      type: "text",
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
};
