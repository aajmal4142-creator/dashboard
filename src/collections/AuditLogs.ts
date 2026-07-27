import type { Access, CollectionConfig, Where } from "payload";

import { denyAll } from "@/lib/access";
import { canWriteOrg } from "@/lib/access/membership";

const auditLogRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const { resolveAccessibleOrgs, hasMinRole } = await import("@/lib/access/membership");
  const orgs = await resolveAccessibleOrgs(req);
  const adminOrgs = orgs.filter((o) => hasMinRole(o.role, "admin")).map((o) => o.orgId);
  if (adminOrgs.length === 0) return false;
  const where: Where = { organisation: { in: adminOrgs } };
  return where;
};

/**
 * Append-only. Update/delete denied for everyone including admins.
 */
export const AuditLogs: CollectionConfig = {
  slug: "audit-logs",
  admin: {
    defaultColumns: ["action", "entityType", "organisation", "createdAt"],
  },
  access: {
    read: auditLogRead,
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
      name: "actor",
      type: "relationship",
      relationTo: "users",
      required: false,
      admin: {
        description:
          "Optional — public supplier token submits may omit actor; reconstruct from after.tokenId / supplierId",
      },
    },
    { name: "action", type: "text", required: true },
    { name: "entityType", type: "text", required: true },
    { name: "entityId", type: "text", required: true },
    { name: "before", type: "json" },
    { name: "after", type: "json" },
    { name: "ip", type: "text" },
    { name: "userAgent", type: "text" },
  ],
  timestamps: true,
};
