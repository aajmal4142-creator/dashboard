import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const EcoVadisConnection: CollectionConfig = {
  slug: "ecovadis-connections",
  admin: {
    useAsTitle: "organisation",
    defaultColumns: ["organisation", "status", "connectedAt", "lastSyncAt"],
  },
  access: tenantAccess({ writeMin: "admin", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "disconnected",
      options: [
        { label: "Connected", value: "connected" },
        { label: "Disconnected", value: "disconnected" },
        { label: "Error", value: "error" },
      ],
    },
    {
      name: "accessToken",
      type: "text",
      required: false,
      admin: { hidden: true },
    },
    {
      name: "refreshToken",
      type: "text",
      required: false,
      admin: { hidden: true },
    },
    {
      name: "expiresAt",
      type: "date",
      required: false,
      admin: { hidden: true },
    },
    {
      name: "connectedAt",
      type: "date",
      required: false,
      index: true,
    },
    {
      name: "lastSyncAt",
      type: "date",
      required: false,
      index: true,
    },
    {
      name: "lastSyncStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Pending", value: "pending" },
      ],
    },
    {
      name: "errorMessage",
      type: "textarea",
      required: false,
    },
    {
      name: "syncCount",
      type: "number",
      defaultValue: 0,
      min: 0,
    },
    {
      name: "totalSuppliersSynced",
      type: "number",
      defaultValue: 0,
      min: 0,
    },
  ],
};
