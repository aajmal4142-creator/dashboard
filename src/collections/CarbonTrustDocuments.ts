import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const CARBON_TRUST_DOCUMENTS_SLUG = "carbon-trust-documents" as const;

export const CarbonTrustDocuments: CollectionConfig = {
  slug: CARBON_TRUST_DOCUMENTS_SLUG,
  admin: {
    useAsTitle: "fileName",
    defaultColumns: ["certification", "fileName", "version", "status", "uploadedAt"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "certification",
      type: "relationship",
      relationTo: "carbon-trust-certifications",
      required: true,
      index: true,
    },
    {
      name: "fileName",
      type: "text",
      required: true,
      admin: { description: "Original file name" },
    },
    {
      name: "fileSize",
      type: "number",
      admin: { description: "File size in bytes" },
    },
    {
      name: "mimeType",
      type: "text",
      admin: { description: "MIME type (e.g., application/pdf)" },
    },
    {
      name: "s3Key",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "S3 storage key/path" },
    },
    {
      name: "sha256Hash",
      type: "text",
      required: true,
      admin: { description: "SHA256 hash for integrity verification" },
    },
    {
      name: "version",
      type: "number",
      defaultValue: 1,
      admin: { description: "Version number (1, 2, 3...)" },
    },
    {
      name: "isLatest",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Mark as latest version" },
    },
    {
      name: "previousVersion",
      type: "relationship",
      relationTo: "carbon-trust-documents",
      admin: { description: "Link to previous version of this document" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Under Review", value: "under_review" },
        { label: "Approved", value: "approved" },
        { label: "Superseded", value: "superseded" },
        { label: "Deleted", value: "deleted" },
      ],
      index: true,
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "What this document contains" },
    },
    {
      name: "changeLog",
      type: "textarea",
      admin: { description: "Summary of changes in this version" },
    },
    {
      name: "uploadedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who uploaded the document" },
    },
    {
      name: "auditorComments",
      type: "textarea",
      admin: { description: "Auditor feedback on this document" },
    },
    {
      name: "reviewedAt",
      type: "date",
      admin: { description: "When auditor reviewed this document" },
    },
    {
      name: "expiresAt",
      type: "date",
      admin: { description: "Optional expiration date for this evidence" },
    },
    {
      name: "tags",
      type: "array",
      fields: [
        {
          name: "tag",
          type: "text",
        },
      ],
      admin: { description: "Tags for categorization and search" },
    },
  ],
  timestamps: true,
};
