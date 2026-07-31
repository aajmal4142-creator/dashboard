import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SUPPLY_CHAIN_NETWORKS_SLUG = "supply-chain-networks" as const;

export const SupplyChainNetworks: CollectionConfig = {
  slug: SUPPLY_CHAIN_NETWORKS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "organisation", "tier_level", "scope", "spend", "estimated"],
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
      name: "networkKey",
      type: "text",
      required: true,
      index: true,
      admin: {
        description:
          "Groups edge rows into one named network snapshot (UUID). Configurable tiers live under this key.",
      },
    },
    {
      name: "networkName",
      type: "text",
      admin: { description: "Display name for the network snapshot" },
    },
    {
      name: "name",
      type: "text",
      required: true,
      admin: { description: "Supply chain relationship / node name" },
    },
    {
      name: "supplier_id",
      type: "relationship",
      relationTo: "suppliers",
      required: false,
      index: true,
      admin: {
        description:
          "Supplier in this relationship (optional for estimated Tier 2/3 placeholders)",
      },
    },
    {
      name: "parent_supplier_id",
      type: "relationship",
      relationTo: "suppliers",
      admin: { description: "Parent supplier (if this is a Tier 2/3)" },
    },
    {
      name: "parentNodeKey",
      type: "text",
      admin: {
        description:
          "Parent edge id or synthetic node key when parent is estimated (no supplier doc)",
      },
    },
    {
      name: "tier_level",
      type: "number",
      required: true,
      min: 1,
      max: 5,
      admin: {
        description: "Tier level: 1 (direct) through 5 — configurable, not hard-coded",
      },
    },
    {
      name: "scope",
      type: "select",
      defaultValue: "Scope3",
      options: [
        { label: "Scope 1", value: "Scope1" },
        { label: "Scope 2", value: "Scope2" },
        { label: "Scope 3", value: "Scope3" },
      ],
      admin: { description: "GHG scope for colour coding on the map" },
    },
    {
      name: "location",
      type: "text",
      admin: { description: "Country / region for location-based estimation" },
    },
    {
      name: "category",
      type: "text",
      admin: { description: "Supplier category (mirrors Suppliers.category when known)" },
    },
    {
      name: "estimated",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "True when Tier 2/3 was estimated (survey / spend), not measured",
      },
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
