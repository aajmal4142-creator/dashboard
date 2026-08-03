import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const Reports: CollectionConfig = {
  slug: "reports",
  admin: {
    defaultColumns: ["organisation", "framework", "version", "status"],
  },
  access: tenantAccess({ writeMin: "admin", adminWriteMin: "admin" }),
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== "update" || !originalDoc) return data;
        if (originalDoc.status !== "published") return data;

        // Final reports stay locked. Allow minting assuranceToken and bumping viewCount/pdfUrl only.
        if (data?.status !== undefined && data.status !== "published") {
          throw new Error(
            "Published reports are immutable. Create a new version instead of unpublishing.",
          );
        }

        const lockedKeys = [
          "snapshot",
          "scores",
          "emissions",
          "dataQualityPct",
          "factorVersionsUsed",
          "framework",
          "period",
          "organisation",
          "version",
          "publishedAt",
          "publishedBy",
          "lockedAt",
          "shareToken",
          "preparedBy",
          "approvedBy",
          "approvedAt",
          "preparerNotes",
          "versionHistory",
          "approvalStep",
          "approvalChainStatus",
          "approvalHistory",
          "approvalAssigneeRole",
          "approvalAssigneeUser",
        ] as const;

        // Payload may include unchanged locked fields on update. Reject only when
        // a locked field's value actually changes (viewCount / pdfUrl / assuranceToken stay allowed).
        for (const key of lockedKeys) {
          if (!Object.prototype.hasOwnProperty.call(data ?? {}, key)) continue;
          const nextVal = (data as Record<string, unknown>)[key];
          const prevVal = (originalDoc as Record<string, unknown>)[key];
          if (JSON.stringify(nextVal) !== JSON.stringify(prevVal)) {
            throw new Error(
              "Published reports are immutable. Create a new version instead of editing a final report.",
            );
          }
        }
        return data;
      },
    ],
  },
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
      index: true,
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
      index: true,
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
      index: true,
      admin: {
        description:
          "Draft is regenerable. Published is final and immutable (chain lock).",
      },
    },
    {
      name: "approvalStep",
      type: "select",
      defaultValue: "prepare",
      index: true,
      options: [
        { label: "Prepare", value: "prepare" },
        { label: "Review", value: "review" },
        { label: "Approve", value: "approve" },
        { label: "Lock", value: "lock" },
      ],
      admin: {
        description: "Publish path: prepare → review → approve → lock (published).",
      },
    },
    {
      name: "approvalChainStatus",
      type: "select",
      defaultValue: "in_progress",
      index: true,
      options: [
        { label: "In progress", value: "in_progress" },
        { label: "Rejected", value: "rejected" },
        { label: "Locked", value: "locked" },
      ],
    },
    {
      name: "approvalAssigneeRole",
      type: "select",
      options: [
        { label: "Contributor", value: "contributor" },
        { label: "Admin", value: "admin" },
        { label: "Owner", value: "owner" },
      ],
    },
    {
      name: "approvalAssigneeUser",
      type: "relationship",
      relationTo: "users",
      index: true,
    },
    {
      name: "approvalHistory",
      type: "array",
      admin: {
        description: "Append-only trail of report approval-chain transitions.",
        readOnly: true,
      },
      fields: [
        {
          name: "fromStep",
          type: "select",
          required: true,
          options: [
            { label: "Prepare", value: "prepare" },
            { label: "Review", value: "review" },
            { label: "Approve", value: "approve" },
            { label: "Lock", value: "lock" },
          ],
        },
        {
          name: "toStep",
          type: "select",
          required: true,
          options: [
            { label: "Prepare", value: "prepare" },
            { label: "Review", value: "review" },
            { label: "Approve", value: "approve" },
            { label: "Lock", value: "lock" },
          ],
        },
        {
          name: "action",
          type: "select",
          required: true,
          options: [
            { label: "Advance", value: "advance" },
            { label: "Reject", value: "reject" },
            { label: "Return", value: "return" },
          ],
        },
        { name: "at", type: "date", required: true },
        {
          name: "actor",
          type: "relationship",
          relationTo: "users",
        },
        { name: "note", type: "textarea" },
        {
          name: "assigneeRole",
          type: "select",
          options: [
            { label: "Contributor", value: "contributor" },
            { label: "Admin", value: "admin" },
            { label: "Owner", value: "owner" },
          ],
        },
        {
          name: "assigneeUser",
          type: "relationship",
          relationTo: "users",
        },
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
    {
      name: "preparedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who prepared this draft or final report" },
    },
    {
      name: "approvedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who approved the report before final lock" },
    },
    { name: "approvedAt", type: "date" },
    {
      name: "preparerNotes",
      type: "textarea",
      admin: {
        description: "Audit / preparer notes included in the Data Integrity PDF section",
      },
    },
    {
      name: "lockedAt",
      type: "date",
      admin: {
        description: "Set when status becomes published — report is immutable thereafter",
      },
    },
    {
      name: "versionHistory",
      type: "array",
      admin: {
        description: "Append-only history of draft regenerations and final lock events",
      },
      fields: [
        { name: "version", type: "number", required: true },
        {
          name: "status",
          type: "select",
          required: true,
          options: [
            { label: "Draft", value: "draft" },
            { label: "Published", value: "published" },
          ],
        },
        { name: "at", type: "date", required: true },
        {
          name: "actor",
          type: "relationship",
          relationTo: "users",
        },
        { name: "note", type: "text" },
        {
          name: "changeSummary",
          type: "json",
          admin: { description: "Diff paths vs previous snapshot when available" },
        },
      ],
    },
  ],
};
