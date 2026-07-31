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
  ],
  timestamps: true,
};
