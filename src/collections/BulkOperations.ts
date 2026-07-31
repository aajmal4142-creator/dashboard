import type { Access, CollectionConfig } from "payload";

import { authenticated } from "@/lib/access";
import { canWriteOrg } from "@/lib/access/membership";

const bulkOpWrite: Access = async ({ req, data }) => {
  if (!req.user) return false;
  const org =
    typeof data?.organisation === "string"
      ? data.organisation
      : (data?.organisation as { id?: string } | undefined)?.id;
  if (!org) return false;
  return canWriteOrg(req, org, "contributor");
};

export const BulkOperations: CollectionConfig = {
  slug: "bulk-operations",
  admin: {
    useAsTitle: "operationType",
    defaultColumns: ["operationType", "status", "itemCount", "actor", "createdAt"],
  },
  access: {
    read: async ({ req, data }) => {
      if (!req.user) return false;
      const isInitiator = data?.actor === req.user.id;
      return isInitiator || bulkOpWrite({ req, data });
    },
    create: authenticated,
    update: bulkOpWrite,
    delete: bulkOpWrite,
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
      required: true,
    },
    {
      name: "operationType",
      type: "select",
      required: true,
      options: [
        { label: "Delete", value: "delete" },
        { label: "Update Status", value: "update-status" },
        { label: "Assign", value: "assign" },
        { label: "Email Reminder", value: "email-reminder" },
        { label: "Export", value: "export" },
        { label: "Update", value: "update" },
      ],
    },
    {
      name: "resourceType",
      type: "select",
      required: true,
      options: [
        { label: "Suppliers", value: "suppliers" },
        { label: "Datapoints", value: "datapoints" },
        { label: "Users", value: "users" },
      ],
    },
    {
      name: "itemIds",
      type: "json",
      required: true,
      admin: {
        description: "Array of resource IDs affected",
      },
    },
    {
      name: "itemCount",
      type: "number",
      required: true,
    },
    {
      name: "changes",
      type: "json",
      admin: {
        description: "Changes applied in this bulk operation",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
      ],
    },
    {
      name: "progressPercent",
      type: "number",
      defaultValue: 0,
    },
    {
      name: "errorMessage",
      type: "textarea",
    },
    {
      name: "beforeSnapshot",
      type: "json",
      admin: {
        description: "Snapshot of items before operation for undo",
      },
    },
    {
      name: "afterSnapshot",
      type: "json",
      admin: {
        description: "Snapshot of items after operation for redo",
      },
    },
    {
      name: "canUndo",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "canRedo",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "undoneAt",
      type: "date",
    },
    {
      name: "redoneAt",
      type: "date",
    },
  ],
  timestamps: true,
};
