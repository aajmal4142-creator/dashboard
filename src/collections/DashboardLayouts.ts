import type { Access, CollectionConfig, Where } from "payload";

import { authenticated } from "@/lib/access";

/** Own layouts only — never cross-user via Payload access. */
const ownLayout: Access = ({ req }) => {
  if (!req.user) return false;
  const where: Where = { userId: { equals: req.user.id } };
  return where;
};

export const DashboardLayouts: CollectionConfig = {
  slug: "dashboard-layouts",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "isDefault", "organisationId", "updatedAt"],
  },
  access: {
    read: ownLayout,
    create: authenticated,
    update: ownLayout,
    delete: ownLayout,
  },
  fields: [
    {
      name: "userId",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "organisationId",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "isDefault",
      type: "checkbox",
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      name: "widgets",
      type: "json",
      required: true,
      admin: {
        description: "Ordered widget definitions (chart | metric | table | list)",
      },
    },
  ],
  timestamps: true,
};
