import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const SUPPLIER_PORTAL_CONFIG_SLUG = "supplier-portal-config" as const;

export const SupplierPortalConfig: CollectionConfig = {
  slug: SUPPLIER_PORTAL_CONFIG_SLUG,
  admin: {
    useAsTitle: "headline",
    defaultColumns: ["organisation", "headline", "enabled", "updatedAt"],
    description:
      "White-label supplier portal copy and chrome options (logo/accent come from org branding)",
  },
  access: tenantAccess({ writeMin: "admin" }),
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
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "When off, public invite links show a paused message",
      },
    },
    {
      name: "headline",
      type: "text",
      defaultValue: "Quick data return",
      admin: { description: "H1 on the public supplier form" },
    },
    {
      name: "welcomeMessage",
      type: "textarea",
      admin: {
        description:
          "Shown under the headline. Leave blank for the ClearESG default welcome.",
      },
    },
    {
      name: "showPoweredBy",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Show “Powered by ClearESG” footer on the public form",
      },
    },
  ],
};
