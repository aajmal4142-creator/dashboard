import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const REPORT_EMBED_TOKENS_SLUG = "report-embed-tokens" as const;

/**
 * Temporary read-only share/embed tokens for interactive HTML reports (S10.1 / S10.3).
 * Opaque UUID token; never embeds organisation id. Default TTL 7 days (1–30 configurable).
 * Tracks usageCount + lastAccessedAt on each public render.
 */
export const ReportEmbedTokens: CollectionConfig = {
  slug: REPORT_EMBED_TOKENS_SLUG,
  admin: {
    useAsTitle: "token",
    defaultColumns: ["report", "organisation", "expiresAt", "usageCount", "revokedAt"],
  },
  access: tenantAccess({ writeMin: "admin", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "report",
      type: "relationship",
      relationTo: "reports",
      required: true,
      index: true,
    },
    {
      name: "token",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Opaque public token — never includes organisation id",
      },
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      index: true,
    },
    {
      name: "usageCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: "lastAccessedAt",
      type: "date",
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "revokedAt",
      type: "date",
      admin: { description: "Set when the token is revoked; access denied thereafter" },
    },
    {
      name: "allowedOrigins",
      type: "text",
      hasMany: true,
      admin: {
        description:
          "Domains allowed to iframe-embed this report (e.g. https://example.com). Empty = embedding denied everywhere; the direct share link still works without a domain.",
      },
    },
    {
      name: "theme",
      type: "select",
      required: true,
      defaultValue: "light",
      options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
        { label: "Match organisation", value: "org" },
      ],
      admin: { description: "Colour theme applied to the embedded/shared report view" },
    },
  ],
  timestamps: true,
};
