import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const CUSTOM_EMISSION_FACTORS_SLUG = "custom-emission-factors" as const;

export const CustomEmissionFactors: CollectionConfig = {
  slug: CUSTOM_EMISSION_FACTORS_SLUG,
  admin: {
    useAsTitle: "factorName",
    defaultColumns: ["factorName", "category", "unit", "effectiveDate", "status"],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "factorName",
      type: "text",
      required: true,
      admin: { description: "Human-readable factor name" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Detailed description of the emissions factor" },
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Energy", value: "energy" },
        { label: "Transportation", value: "transport" },
        { label: "Water", value: "water" },
        { label: "Waste", value: "waste" },
        { label: "Procurement", value: "procurement" },
        { label: "Manufacturing", value: "manufacturing" },
        { label: "Business Travel", value: "travel" },
        { label: "Commuting", value: "commuting" },
        // Spend ledger categories (F7) — align with spend-based-emissions
        { label: "Raw Materials (spend)", value: "raw_materials" },
        { label: "Packaging (spend)", value: "packaging" },
        { label: "Fuel & Energy (spend)", value: "fuel_energy" },
        { label: "Business Services (spend)", value: "services" },
        { label: "Transportation (spend)", value: "transportation" },
        { label: "Facilities (spend)", value: "facilities" },
        { label: "IT & Software (spend)", value: "it" },
      ],
      index: true,
    },
    {
      name: "subcategory",
      type: "text",
      admin: { description: "e.g., Grid Electricity, Natural Gas, Diesel" },
    },
    {
      name: "value",
      type: "number",
      required: true,
      admin: { description: "Emissions factor value" },
    },
    {
      name: "unit",
      type: "select",
      required: true,
      options: [
        { label: "kg CO2e / kWh", value: "kg_co2e_kwh" },
        { label: "kg CO2e / liter", value: "kg_co2e_liter" },
        { label: "kg CO2e / kg", value: "kg_co2e_kg" },
        { label: "kg CO2e / m3", value: "kg_co2e_m3" },
        { label: "kg CO2e / mile", value: "kg_co2e_mile" },
        { label: "kg CO2e / km", value: "kg_co2e_km" },
        { label: "kg CO2e / USD", value: "kg_co2e_usd" },
        { label: "kg CO2e / EUR", value: "kg_co2e_eur" },
        { label: "kg CO2e / GBP", value: "kg_co2e_gbp" },
        { label: "kg CO2e / INR", value: "kg_co2e_inr" },
        { label: "kg CO2e / employee", value: "kg_co2e_employee" },
      ],
      index: true,
    },
    {
      name: "source",
      type: "select",
      required: true,
      options: [
        { label: "USEEIO", value: "useeio" },
        { label: "EXIOBASE", value: "exiobase" },
        { label: "IPCC", value: "ipcc" },
        { label: "EPA", value: "epa" },
        { label: "UK DEFRA", value: "defra" },
        { label: "ADEME", value: "ademe" },
        { label: "Custom", value: "custom" },
        { label: "Supplier Data", value: "supplier" },
      ],
    },
    {
      name: "sourceReference",
      type: "text",
      admin: { description: "Publication, report, or data source reference" },
    },
    {
      name: "region",
      type: "text",
      admin: { description: "Geographic region (e.g., US, EU, UK, India)" },
    },
    {
      name: "effectiveDate",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { description: "When this factor becomes effective" },
    },
    {
      name: "expiryDate",
      type: "date",
      admin: { description: "When this factor is superseded (optional)" },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Deprecated", value: "deprecated" },
        { label: "Testing", value: "testing" },
        { label: "Draft", value: "draft" },
      ],
      index: true,
    },
    {
      name: "confidence",
      type: "select",
      defaultValue: "medium",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
      admin: { description: "Confidence level in the factor accuracy" },
    },
    {
      name: "uncertainty",
      type: "number",
      admin: { description: "Uncertainty range as percentage (0-100)" },
    },
    {
      name: "precedingFactorId",
      type: "relationship",
      relationTo: CUSTOM_EMISSION_FACTORS_SLUG,
      admin: { description: "If this replaces a previous factor, reference it" },
    },
    {
      name: "applicability",
      type: "array",
      fields: [
        {
          name: "condition",
          type: "text",
          required: true,
          admin: { description: "e.g., Company size, Region, Industry" },
        },
        {
          name: "value",
          type: "text",
          required: true,
          admin: { description: "Applicable value or range" },
        },
      ],
    },
    {
      name: "metadata",
      type: "json",
      admin: { description: "Additional metadata (GHG protocol scope, etc.)" },
    },
    {
      name: "usageCount",
      type: "number",
      defaultValue: 0,
      admin: { description: "Number of calculations using this factor" },
    },
    {
      name: "lastUsedAt",
      type: "date",
      admin: { description: "Last calculation using this factor" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "approvedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who approved this factor" },
    },
    {
      name: "approvalDate",
      type: "date",
      admin: { description: "When this factor was approved for use" },
    },
    {
      name: "auditTrail",
      type: "array",
      fields: [
        {
          name: "timestamp",
          type: "date",
          required: true,
        },
        {
          name: "action",
          type: "text",
          required: true,
          admin: { description: "e.g., Created, Modified, Deprecated" },
        },
        {
          name: "changedBy",
          type: "text",
        },
        {
          name: "details",
          type: "textarea",
        },
      ],
    },
  ],
};
