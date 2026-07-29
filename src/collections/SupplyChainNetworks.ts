import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SupplyChainNetworks: CollectionConfig = {
  slug: "supply-chain-networks",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "organisation", "tier_level", "spend"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
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
      admin: { description: "Supply chain relationship name" },
    },
    {
      name: "supplier_id",
      type: "relationship",
      relationTo: "suppliers",
      required: true,
      index: true,
      admin: { description: "Supplier in this relationship" },
    },
    {
      name: "parent_supplier_id",
      type: "relationship",
      relationTo: "suppliers",
      admin: { description: "Parent supplier (if this is a Tier 2/3)" },
    },
    {
      name: "tier_level",
      type: "number",
      required: true,
      min: 1,
      max: 5,
      admin: { description: "Tier level: 1 (direct), 2, 3, etc." },
    },
    {
      name: "spend",
      type: "number",
      min: 0,
      admin: { description: "Annual spend with this supplier" },
    },
    {
      name: "emissions",
      type: "number",
      min: 0,
      admin: { description: "Annual emissions from this supplier (tonnes CO2e)" },
    },
    {
      name: "relationship_strength",
      type: "select",
      options: [
        { label: "Critical", value: "critical" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      admin: { description: "Strategic importance of this relationship" },
    },
  ],
};
