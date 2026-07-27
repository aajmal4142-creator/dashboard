import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ReportingPeriods: CollectionConfig = {
  slug: "reporting-periods",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["label", "organisation", "status", "startDate", "endDate"],
  },
  access: tenantAccess({ writeMin: "admin", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    { name: "label", type: "text", required: true },
    { name: "startDate", type: "date", required: true },
    { name: "endDate", type: "date", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Locked", value: "locked" },
        { label: "Published", value: "published" },
      ],
    },
    { name: "lockedAt", type: "date" },
    {
      name: "lockedBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
};
