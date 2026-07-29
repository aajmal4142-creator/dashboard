import type { Access, CollectionConfig, Where } from "payload";

import { canWriteOrg } from "@/lib/access/membership";

const customRoleRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const { resolveAccessibleOrgs, hasMinRole } = await import("@/lib/access/membership");
  const orgs = await resolveAccessibleOrgs(req);
  const adminOrgs = orgs.filter((o) => hasMinRole(o.role, "admin")).map((o) => o.orgId);
  if (adminOrgs.length === 0) return false;
  const where: Where = { organisation: { in: adminOrgs } };
  return where;
};

const customRoleWrite: Access = async ({ req, id }) => {
  if (!req.user || !id) return false;
  return canWriteOrg(req, String(id), "admin");
};

export const CustomRoles: CollectionConfig = {
  slug: "custom-roles",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "organisation", "isTemplate", "createdAt"],
  },
  access: {
    read: customRoleRead,
    create: async ({ req, data }) => {
      if (!req.user) return false;
      const org =
        typeof data?.organisation === "string"
          ? data.organisation
          : (data?.organisation as { id?: string } | undefined)?.id;
      if (!org) return false;
      return canWriteOrg(req, org, "admin");
    },
    update: customRoleWrite,
    delete: customRoleWrite,
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
      name: "name",
      type: "text",
      required: true,
      unique: false,
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "isTemplate",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "System template roles are shared across all organisations",
      },
    },
    {
      name: "permissions",
      type: "json",
      required: true,
      admin: {
        description:
          "Capability matrix: { action: [resources], ...} e.g. { read: [suppliers, reports], write: [materiality] }",
      },
    },
    {
      name: "resourceScopes",
      type: "json",
      admin: {
        description:
          "Scope limits per resource: { resource: scope, ...} e.g. { suppliers: own, reports: team }",
      },
    },
    {
      name: "inheritsFrom",
      type: "relationship",
      relationTo: "custom-roles",
      admin: {
        description: "Parent role for hierarchy",
      },
    },
    {
      name: "memberCount",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
};
