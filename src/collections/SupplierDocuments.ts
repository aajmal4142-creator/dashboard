import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SupplierDocuments: CollectionConfig = {
  slug: "supplier-documents",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["supplier", "docType", "uploadedAt", "expiryDate"],
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
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      required: true,
      index: true,
    },
    {
      name: "filename",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "docType",
      type: "select",
      required: true,
      options: [
        { label: "Sustainability Report", value: "sustainability_report" },
        { label: "ESG Report", value: "esg_report" },
        { label: "Certification", value: "certification" },
        { label: "Carbon Data", value: "carbon_data" },
        { label: "Audit Report", value: "audit_report" },
        { label: "Third-party Verification", value: "verification" },
        { label: "Policy Document", value: "policy" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "fileSize",
      type: "number",
      admin: { description: "File size in bytes" },
    },
    {
      name: "mimeType",
      type: "text",
      admin: { description: "e.g., application/pdf, image/png" },
    },
    {
      name: "filePath",
      type: "text",
      required: true,
      admin: { description: "S3 or local storage path" },
    },
    {
      name: "version",
      type: "text",
      defaultValue: "1.0",
      admin: { description: "Document version (e.g., 1.0, 1.1)" },
    },
    {
      name: "supersededBy",
      type: "relationship",
      relationTo: "supplier-documents",
      admin: { description: "If replaced by newer version" },
    },
    {
      name: "uploadedBy",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "uploadedAt",
      type: "date",
      required: true,
      admin: { description: "When file was uploaded" },
    },
    {
      name: "expiryDate",
      type: "date",
      admin: { description: "For certifications that expire" },
    },
    {
      name: "tags",
      type: "text",
      hasMany: true,
      admin: { description: "Searchable tags" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Optional document description" },
    },
    {
      name: "virusScanStatus",
      type: "select",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Clean", value: "clean" },
        { label: "Infected", value: "infected" },
        { label: "Inconclusive", value: "inconclusive" },
      ],
    },
    {
      name: "virusScanResult",
      type: "textarea",
      admin: { description: "Detailed virus scan results" },
    },
    {
      name: "linkedCheckpoints",
      type: "relationship",
      relationTo: "compliance-checkpoints",
      hasMany: true,
      admin: { description: "Compliance checkpoints this document satisfies" },
    },
    {
      name: "linkedFindings",
      type: "relationship",
      relationTo: "verification-findings",
      hasMany: true,
      admin: { description: "Audit findings this document addresses" },
    },
  ],
};
