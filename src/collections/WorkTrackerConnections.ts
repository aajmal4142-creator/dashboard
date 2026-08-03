import type { CollectionConfig } from "payload";

import { accessibleOrgIds } from "@/lib/access/membership";

export const WORK_TRACKER_CONNECTIONS_SLUG = "work-tracker-connections" as const;

/**
 * Jira / Linear connections for pushing ClearESG compliance tasks (Sprint 9 F29).
 * API tokens are AES-256-GCM encrypted at rest; never return ciphertext to clients.
 */
export const WorkTrackerConnections: CollectionConfig = {
  slug: WORK_TRACKER_CONNECTIONS_SLUG,
  admin: {
    useAsTitle: "label",
    defaultColumns: [
      "label",
      "provider",
      "status",
      "projectOrTeamId",
      "enabled",
      "lastSyncAt",
    ],
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
      name: "provider",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Jira", value: "jira" },
        { label: "Linear", value: "linear" },
      ],
    },
    {
      name: "label",
      type: "text",
      required: true,
      admin: { description: "Human-readable connection name" },
    },
    {
      name: "baseUrl",
      type: "text",
      required: true,
      admin: {
        description:
          "Jira: https://{site}.atlassian.net or https://api.atlassian.com/ex/jira/{cloudId}. Linear: https://api.linear.app",
      },
    },
    {
      name: "workspaceKey",
      type: "text",
      admin: {
        description: "Optional workspace / cloud id / site key for display",
      },
    },
    {
      name: "accountEmail",
      type: "text",
      admin: {
        description: "Atlassian account email (required for Jira API token auth)",
      },
    },
    {
      name: "encryptedToken",
      type: "textarea",
      required: true,
      admin: {
        readOnly: true,
        description: "AES-256-GCM ciphertext. Never log or return to clients.",
      },
    },
    {
      name: "projectOrTeamId",
      type: "text",
      required: true,
      admin: {
        description: "Jira project key/id or Linear team id",
      },
    },
    {
      name: "projectOrTeamName",
      type: "text",
      admin: { description: "Display name for the mapped project / team" },
    },
    {
      name: "issueTypeName",
      type: "text",
      defaultValue: "Task",
      admin: {
        description: "Jira issue type name (ignored for Linear)",
      },
    },
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Connected", value: "connected" },
        { label: "Failed", value: "failed" },
        { label: "Disconnected", value: "disconnected" },
      ],
    },
    {
      name: "lastSyncAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "lastError",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "lastExternalId",
      type: "text",
      admin: { readOnly: true, description: "Last created issue id" },
    },
    {
      name: "lastExternalKey",
      type: "text",
      admin: { readOnly: true, description: "Last created issue key / identifier" },
    },
    {
      name: "lastExternalUrl",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "lastEntityType",
      type: "select",
      options: [
        { label: "Internal request", value: "internal_request" },
        { label: "Compliance obligation", value: "compliance_obligation" },
      ],
      admin: { readOnly: true },
    },
    {
      name: "lastEntityId",
      type: "text",
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
