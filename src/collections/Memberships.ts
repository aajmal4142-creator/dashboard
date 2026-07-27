import type { Access, CollectionConfig, Where } from "payload";

import {
  accessibleOrgIds,
  canWriteOrg,
  hasMinRole,
  roleInOrg,
} from "@/lib/access/membership";

const membershipRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const ids = await accessibleOrgIds(req);
  if (ids.length === 0) {
    const where: Where = { user: { equals: req.user.id } };
    return where;
  }
  const where: Where = {
    or: [{ user: { equals: req.user.id } }, { organisation: { in: ids } }],
  };
  return where;
};

export const Memberships: CollectionConfig = {
  slug: "memberships",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["user", "organisation", "role", "status"],
  },
  access: {
    read: membershipRead,
    create: async ({ req, data }) => {
      if (!req.user) return false;
      const org =
        typeof data?.organisation === "string"
          ? data.organisation
          : (data?.organisation as { id?: string } | undefined)?.id;
      if (!org) return false;
      return canWriteOrg(req, org, "admin");
    },
    update: async ({ req, id }) => {
      if (!req.user || !id) return false;
      const doc = await req.payload.findByID({
        collection: "memberships",
        id: String(id),
        depth: 0,
        overrideAccess: true,
      });
      const orgId =
        typeof doc.organisation === "string"
          ? doc.organisation
          : (doc.organisation as { id: string }).id;
      return canWriteOrg(req, orgId, "admin");
    },
    delete: async ({ req, id }) => {
      if (!req.user || !id) return false;
      const doc = await req.payload.findByID({
        collection: "memberships",
        id: String(id),
        depth: 0,
        overrideAccess: true,
      });
      const orgId =
        typeof doc.organisation === "string"
          ? doc.organisation
          : (doc.organisation as { id: string }).id;
      const role = await roleInOrg(req, orgId);
      return hasMinRole(role, "owner");
    },
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      options: [
        { label: "Owner", value: "owner" },
        { label: "Admin", value: "admin" },
        { label: "Contributor", value: "contributor" },
        { label: "Viewer", value: "viewer" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "invited",
      options: [
        { label: "Active", value: "active" },
        { label: "Invited", value: "invited" },
        { label: "Revoked", value: "revoked" },
      ],
    },
    {
      name: "invitedBy",
      type: "relationship",
      relationTo: "users",
    },
    { name: "invitedAt", type: "date" },
    { name: "acceptedAt", type: "date" },
  ],
};
