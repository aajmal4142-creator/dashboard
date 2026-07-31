import type { Access, CollectionConfig } from "payload";

import { authenticated } from "@/lib/access";
import { canReadOrg } from "@/lib/access/membership";

const savedFilterRead: Access = async ({ req, data }) => {
  if (!req.user) return false;

  const org =
    typeof data?.organisation === "string"
      ? data.organisation
      : (data?.organisation as { id?: string } | undefined)?.id;

  if (!org) return false;
  const isOwner = data?.owner === req.user.id;
  const isSharedWithTeam = data?.isSharedWithTeam === true;

  if (isOwner || isSharedWithTeam) {
    return canReadOrg(req, org);
  }

  return false;
};

export const SavedFilters: CollectionConfig = {
  slug: "saved-filters",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "resourceType", "owner", "isSharedWithTeam", "createdAt"],
  },
  access: {
    read: savedFilterRead,
    create: authenticated,
    update: async ({ req, id, data }) => {
      if (!req.user || !id) return false;
      const isOwner = data?.owner === req.user.id;
      return isOwner;
    },
    delete: async ({ req, id, data }) => {
      if (!req.user || !id) return false;
      const isOwner = data?.owner === req.user.id;
      return isOwner;
    },
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
      name: "owner",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "resourceType",
      type: "select",
      required: true,
      options: [
        { label: "Suppliers", value: "suppliers" },
        { label: "Datapoints", value: "datapoints" },
        { label: "Reports", value: "reports" },
        { label: "Audit Logs", value: "audit-logs" },
        { label: "Users", value: "users" },
        { label: "Materiality", value: "materiality" },
        { label: "Obligations", value: "obligations" },
        { label: "Search", value: "search" },
      ],
    },
    {
      name: "filterConditions",
      type: "json",
      required: true,
      admin: {
        description: "Query conditions for the filter",
      },
    },
    {
      name: "sortConfig",
      type: "json",
      admin: {
        description: "Sort field and order",
      },
    },
    {
      name: "isDefault",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Set as default view for this resource type",
      },
    },
    {
      name: "isSharedWithTeam",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "sharedWith",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: {
        description: "Specific users this filter is shared with",
      },
    },
  ],
  timestamps: true,
};
