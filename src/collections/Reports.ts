import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const Reports: CollectionConfig = {
  slug: "reports",
  admin: {
    defaultColumns: ["organisation", "framework", "version", "status"],
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
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
    },
    {
      name: "framework",
      type: "select",
      required: true,
      options: [
        { label: "CSRD Set 1", value: "CSRD_SET1" },
        { label: "CSRD Simplified", value: "CSRD_SIMPLIFIED" },
        { label: "BRSR", value: "BRSR" },
        { label: "VSME", value: "VSME" },
        { label: "GRI", value: "GRI" },
        { label: "Custom", value: "CUSTOM" },
      ],
    },
    { name: "version", type: "number", required: true, defaultValue: 1, min: 1 },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    },
    {
      name: "scores",
      type: "group",
      fields: [
        { name: "overall", type: "number" },
        { name: "e", type: "number" },
        { name: "s", type: "number" },
        { name: "g", type: "number" },
      ],
    },
    {
      name: "emissions",
      type: "group",
      fields: [
        { name: "scope1", type: "number" },
        { name: "scope2", type: "number" },
        { name: "scope3", type: "number" },
      ],
    },
    { name: "dataQualityPct", type: "number", min: 0, max: 100 },
    {
      name: "factorVersionsUsed",
      type: "relationship",
      relationTo: "emission-factors",
      hasMany: true,
    },
    {
      name: "snapshot",
      type: "json",
      admin: {
        description: "Immutable publish payload — never mutate after published",
      },
    },
    { name: "pdfUrl", type: "text" },
    { name: "shareToken", type: "text", unique: true, index: true },
    {
      name: "assuranceToken",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description:
          "Token for read-only /a/[token] Assurance Room (no Membership role).",
      },
    },
    { name: "shareExpiresAt", type: "date" },
    { name: "viewCount", type: "number", defaultValue: 0, min: 0 },
    { name: "publishedAt", type: "date" },
    {
      name: "publishedBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
};
