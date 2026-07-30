import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const SPEND_BASED_EMISSIONS_SLUG = "spend-based-emissions" as const;

export const SpendBasedEmissions: CollectionConfig = {
  slug: SPEND_BASED_EMISSIONS_SLUG,
  admin: {
    useAsTitle: "category",
    defaultColumns: ["category", "periodStart", "totalSpend", "calculatedEmissions"],
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
      name: "periodStart",
      type: "date",
      required: true,
      index: true,
      admin: { description: "Start of billing/accounting period" },
    },
    {
      name: "periodEnd",
      type: "date",
      required: true,
      admin: { description: "End of billing/accounting period" },
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Raw Materials", value: "raw_materials" },
        { label: "Packaging", value: "packaging" },
        { label: "Fuel & Energy", value: "fuel_energy" },
        { label: "Waste Disposal", value: "waste" },
        { label: "Business Services", value: "services" },
        { label: "Transportation", value: "transportation" },
        { label: "Facilities", value: "facilities" },
        { label: "IT & Software", value: "it" },
      ],
      index: true,
    },
    {
      name: "subcategory",
      type: "text",
      admin: { description: "More specific category (e.g., Electricity, Natural Gas)" },
    },
    {
      name: "glCodeRange",
      type: "array",
      admin: {
        description: "General Ledger account codes associated with this spend",
      },
      fields: [
        {
          name: "glCode",
          type: "text",
          required: true,
        },
        {
          name: "description",
          type: "text",
        },
      ],
    },
    {
      name: "totalSpend",
      type: "number",
      required: true,
      admin: { description: "Total spend in currency (usually USD)" },
    },
    {
      name: "currency",
      type: "select",
      defaultValue: "USD",
      options: [
        { label: "USD", value: "USD" },
        { label: "EUR", value: "EUR" },
        { label: "GBP", value: "GBP" },
        { label: "INR", value: "INR" },
      ],
    },
    {
      name: "emissionsFactor",
      type: "number",
      required: true,
      admin: { description: "kg CO2e per currency unit (from IO table)" },
    },
    {
      name: "emissionsFactorSource",
      type: "select",
      required: true,
      options: [
        { label: "USEEIO", value: "useeio" },
        { label: "EXIOBASE", value: "exiobase" },
        { label: "Custom Database", value: "custom" },
        { label: "Supplier Specific", value: "supplier" },
      ],
    },
    {
      name: "emissionsFactorVersion",
      type: "text",
      admin: { description: "Version/year of the emissions factor (e.g., 2022)" },
    },
    {
      name: "industryCode",
      type: "text",
      admin: { description: "NAICS or industry classification code" },
    },
    {
      name: "region",
      type: "text",
      index: true,
      admin: {
        description: "Geographic region used for factor lookup / regional adjustment",
      },
    },
    {
      name: "calculatedEmissions",
      type: "number",
      required: true,
      admin: { description: "Calculated emissions: Spend × Factor (kg CO2e)" },
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
      admin: { description: "Confidence in this calculation" },
    },
    {
      name: "uncertainty",
      type: "number",
      admin: { description: "Uncertainty range as percentage (0-100)" },
    },
    {
      name: "actualEmissions",
      type: "number",
      admin: { description: "Actually measured emissions (kg CO2e)" },
    },
    {
      name: "variancePercent",
      type: "number",
      admin: { description: "Variance between calculated and actual (%)" },
    },
    {
      name: "actualEmissionsSource",
      type: "text",
      admin: { description: "Source of actual data (meter, invoice, etc.)" },
    },
    {
      name: "activityQuantity",
      type: "number",
    },
    {
      name: "activityUnit",
      type: "text",
      admin: { description: "kWh, kg, liters, etc." },
    },
    {
      name: "activityFactor",
      type: "number",
      admin: { description: "Emissions factor per activity unit" },
    },
    {
      name: "calculatedFromActivity",
      type: "number",
      admin: { description: "Emissions calculated from activity (kg CO2e)" },
    },
    {
      name: "scope",
      type: "select",
      options: [
        { label: "Scope 1", value: "1" },
        { label: "Scope 2", value: "2" },
        { label: "Scope 3", value: "3" },
      ],
      required: true,
      admin: { description: "GHG Protocol scope" },
    },
    {
      name: "dataQuality",
      type: "select",
      defaultValue: "estimated",
      options: [
        { label: "Actual", value: "actual" },
        { label: "Measured", value: "measured" },
        { label: "Estimated", value: "estimated" },
        { label: "Supplier Data", value: "supplier" },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Notes on calculation methodology or assumptions" },
    },
    {
      name: "sourceDocuments",
      type: "array",
      fields: [
        {
          name: "document",
          type: "relationship",
          relationTo: "media",
          admin: { description: "Supporting document (invoice, report, etc.)" },
        },
        {
          name: "description",
          type: "text",
        },
      ],
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
        },
        {
          name: "changedBy",
          type: "relationship",
          relationTo: "users",
        },
        {
          name: "changes",
          type: "json",
        },
      ],
    },
  ],
};
