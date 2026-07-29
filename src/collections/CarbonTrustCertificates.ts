import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const CARBON_TRUST_CERTIFICATES_SLUG = "carbon-trust-certificates" as const;

export const CarbonTrustCertificates: CollectionConfig = {
  slug: CARBON_TRUST_CERTIFICATES_SLUG,
  admin: {
    useAsTitle: "certificateNumber",
    defaultColumns: [
      "organisation",
      "certificateNumber",
      "issuedAt",
      "expiresAt",
      "status",
    ],
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
      name: "certification",
      type: "relationship",
      relationTo: "carbon-trust-certifications",
      required: true,
      unique: true,
    },
    {
      name: "certificateNumber",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Unique certificate number for public verification" },
    },
    {
      name: "pdfUrl",
      type: "text",
      required: true,
      admin: { description: "S3 URL to generated PDF certificate" },
    },
    {
      name: "pdfS3Key",
      type: "text",
      required: true,
      admin: { description: "S3 storage key for PDF" },
    },
    {
      name: "issuedAt",
      type: "date",
      required: true,
      admin: { description: "Certificate issue date" },
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      admin: { description: "Certificate expiration date (3 years)" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Expiring Soon", value: "expiring_soon" },
        { label: "Expired", value: "expired" },
        { label: "Revoked", value: "revoked" },
      ],
      index: true,
    },
    {
      name: "verificationToken",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Token for public verification link" },
    },
    {
      name: "verificationUrl",
      type: "text",
      admin: { description: "Public verification URL" },
    },
    {
      name: "revokedAt",
      type: "date",
      admin: { description: "When certificate was revoked (if applicable)" },
    },
    {
      name: "revocationReason",
      type: "textarea",
      admin: { description: "Reason for revocation" },
    },
    {
      name: "scope",
      type: "select",
      required: true,
      options: [
        { label: "Scope 1", value: "scope1" },
        { label: "Scope 2", value: "scope2" },
        { label: "Scope 3", value: "scope3" },
        { label: "All Scopes", value: "all" },
      ],
      admin: { description: "Coverage scope of certification" },
    },
    {
      name: "emissionBaselineYear",
      type: "number",
      admin: { description: "Baseline year for emissions reduction tracking" },
    },
    {
      name: "baselineEmissions",
      type: "number",
      admin: { description: "Baseline emissions in tCO2e" },
    },
    {
      name: "verifiedEmissions",
      type: "number",
      admin: { description: "Currently verified emissions in tCO2e" },
    },
    {
      name: "publiclyListed",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Whether this certificate is publicly searchable" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who generated the certificate" },
    },
  ],
  timestamps: true,
};
