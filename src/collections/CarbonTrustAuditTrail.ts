import type { Access, CollectionConfig, Where } from "payload";
import { denyAll } from "@/lib/access";
import { canWriteOrg } from "@/lib/access/membership";

const auditTrailRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const { resolveAccessibleOrgs, hasMinRole } = await import("@/lib/access/membership");
  const orgs = await resolveAccessibleOrgs(req);
  const adminOrgs = orgs.filter((o) => hasMinRole(o.role, "admin")).map((o) => o.orgId);
  if (adminOrgs.length === 0) return false;
  const where: Where = { organisation: { in: adminOrgs } };
  return where;
};

export const CarbonTrustAuditTrail: CollectionConfig = {
  slug: "carbon-trust-audit-trail",
  admin: {
    defaultColumns: ["action", "entityType", "organisation", "createdAt"],
  },
  access: {
    read: auditTrailRead,
    create: async ({ req, data }) => {
      if (!req.user) return false;
      const org =
        typeof data?.organisation === "string"
          ? data.organisation
          : (data?.organisation as { id?: string } | undefined)?.id;
      if (!org) return false;
      return canWriteOrg(req, org, "contributor");
    },
    update: denyAll,
    delete: denyAll,
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
      name: "certification",
      type: "relationship",
      relationTo: "carbon-trust-certifications",
      required: true,
      index: true,
    },
    {
      name: "actor",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: { description: "User who performed the action" },
    },
    {
      name: "action",
      type: "text",
      required: true,
      admin: {
        description:
          "Action performed (e.g., created, submitted, approved, rejected, document_uploaded)",
      },
    },
    {
      name: "entityType",
      type: "text",
      required: true,
      admin: {
        description: "Type of entity affected (certification, checklist_item, document)",
      },
    },
    {
      name: "entityId",
      type: "text",
      required: true,
      admin: { description: "ID of the affected entity" },
    },
    {
      name: "before",
      type: "json",
      admin: { description: "State before the action" },
    },
    {
      name: "after",
      type: "json",
      admin: { description: "State after the action" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Human-readable description of what changed" },
    },
    {
      name: "ipAddress",
      type: "text",
      admin: { description: "IP address of the actor" },
    },
    {
      name: "userAgent",
      type: "text",
      admin: { description: "User agent string" },
    },
    {
      name: "metadata",
      type: "json",
      admin: { description: "Additional context (e.g., document version, file hash)" },
    },
  ],
  timestamps: true,
};
