import type { CollectionConfig } from "payload";

import { accessibleOrgIds } from "@/lib/access/membership";

export const SLACK_INTEGRATIONS_SLUG = "slack-integrations" as const;

export const SlackIntegrations: CollectionConfig = {
  slug: SLACK_INTEGRATIONS_SLUG,
  admin: {
    useAsTitle: "teamName",
    defaultColumns: ["teamName", "status", "defaultChannelName", "installedAt"],
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
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Connected", value: "connected" },
        { label: "Disconnected", value: "disconnected" },
        { label: "Failed", value: "failed" },
      ],
      index: true,
    },
    {
      name: "teamId",
      type: "text",
      admin: { description: "Slack workspace (team) ID" },
    },
    {
      name: "teamName",
      type: "text",
      admin: { description: "Slack workspace name" },
    },
    {
      name: "botToken",
      type: "text",
      admin: {
        description: "Bot OAuth token (AES-256-GCM encrypted at rest)",
        readOnly: true,
      },
    },
    {
      name: "botUserId",
      type: "text",
      admin: { description: "Installed bot user ID", readOnly: true },
    },
    {
      name: "defaultChannelId",
      type: "text",
      admin: { description: "Default channel for alert posts" },
    },
    {
      name: "defaultChannelName",
      type: "text",
      admin: { description: "Default channel display name" },
    },
    {
      name: "channelMappings",
      type: "array",
      admin: {
        description: "Optional per-event channel overrides",
      },
      fields: [
        {
          name: "event",
          type: "select",
          required: true,
          options: [
            { label: "Alert triggered", value: "alert_triggered" },
            { label: "Datapoint approved", value: "datapoint_approved" },
            { label: "Report ready", value: "report_ready" },
            { label: "Audit complete", value: "audit_complete" },
          ],
        },
        {
          name: "channelId",
          type: "text",
          required: true,
        },
        {
          name: "channelName",
          type: "text",
        },
      ],
    },
    {
      name: "enableSlashCommands",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "enableInteractiveButtons",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "installedAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "installedBy",
      type: "relationship",
      relationTo: "users",
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
