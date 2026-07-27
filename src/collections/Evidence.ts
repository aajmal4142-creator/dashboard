import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const Evidence: CollectionConfig = {
  slug: "evidence",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "organisation", "sha256", "ocrStatus"],
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
      name: "file",
      type: "upload",
      relationTo: "media",
      required: true,
    },
    { name: "filename", type: "text", required: true },
    { name: "mimeType", type: "text" },
    { name: "size", type: "number" },
    { name: "sha256", type: "text", index: true, required: true },
    {
      name: "uploadedBy",
      type: "relationship",
      relationTo: "users",
    },
    { name: "uploadedAt", type: "date", required: true },
    {
      name: "coverageStart",
      type: "date",
      admin: {
        description:
          "Start of the period this evidence covers (for assurance freshness).",
      },
    },
    {
      name: "coverageEnd",
      type: "date",
      admin: {
        description: "End of the period this evidence covers (for assurance freshness).",
      },
    },
    {
      name: "linkedDatapoints",
      type: "relationship",
      relationTo: "datapoints",
      hasMany: true,
    },
    {
      name: "whyNote",
      type: "textarea",
      admin: {
        description:
          "Why this document proves the figure — shown to auditors and reviewers.",
      },
    },
    { name: "extractedData", type: "json" },
    {
      name: "ocrStatus",
      type: "select",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Done", value: "done" },
        { label: "Failed", value: "failed" },
        {
          label: "Skipped",
          value: "skipped",
        },
      ],
      admin: {
        description:
          "OCR is not productized; new uploads should set skipped until a worker ships.",
      },
    },
  ],
};
