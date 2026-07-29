import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const PRODUCT_LEVEL_FOOTPRINTING_SLUG = "product-level-footprinting" as const;

export const ProductLevelFootprinting: CollectionConfig = {
  slug: PRODUCT_LEVEL_FOOTPRINTING_SLUG,
  admin: {
    useAsTitle: "productName",
    defaultColumns: ["productName", "sku", "category", "totalCarbonFootprint", "status"],
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
      name: "productName",
      type: "text",
      required: true,
      admin: { description: "Product name" },
    },
    {
      name: "sku",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Stock Keeping Unit (unique product code)" },
    },
    {
      name: "category",
      type: "text",
      required: true,
      admin: { description: "Product category (e.g., Electronics, Apparel)" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Product description" },
    },
    {
      name: "unit",
      type: "select",
      options: [
        { label: "Per Unit", value: "per_unit" },
        { label: "Per Kilogram", value: "per_kg" },
        { label: "Per Liter", value: "per_liter" },
        { label: "Per Service (SaaS)", value: "per_service" },
      ],
      defaultValue: "per_unit",
    },
    {
      name: "billOfMaterials",
      type: "array",
      admin: { description: "Components and materials in product" },
      fields: [
        {
          name: "material",
          type: "text",
          required: true,
          admin: { description: "Material name" },
        },
        {
          name: "quantity",
          type: "number",
          required: true,
        },
        {
          name: "unit",
          type: "text",
          required: true,
          admin: { description: "kg, liter, meters, etc." },
        },
        {
          name: "supplierEmissionFactor",
          type: "number",
          admin: { description: "Supplier-specific emissions factor (kg CO2e)" },
        },
        {
          name: "factorSource",
          type: "select",
          options: [
            { label: "Supplier Data", value: "supplier" },
            { label: "Industry Database", value: "industry" },
            { label: "Custom Factor", value: "custom" },
          ],
        },
        {
          name: "materialCarbonFootprint",
          type: "number",
          admin: { description: "Calculated emissions for this material (kg CO2e)" },
        },
      ],
    },
    {
      name: "manufacturingProcess",
      type: "textarea",
      admin: { description: "Description of manufacturing process" },
    },
    {
      name: "emissionsSources",
      type: "array",
      admin: { description: "Manufacturing process emission sources" },
      fields: [
        {
          name: "source",
          type: "text",
          required: true,
          admin: { description: "e.g., Electricity, Heat, Steam" },
        },
        {
          name: "quantity",
          type: "number",
          required: true,
        },
        {
          name: "unit",
          type: "text",
          required: true,
        },
        {
          name: "emissionsFactor",
          type: "number",
          required: true,
        },
        {
          name: "totalEmissions",
          type: "number",
        },
      ],
    },
    {
      name: "totalManufacturingEmissions",
      type: "number",
      admin: { description: "Total manufacturing stage emissions (kg CO2e)" },
    },
    {
      name: "primaryPackaging",
      type: "text",
      admin: { description: "Main package material" },
    },
    {
      name: "primaryWeight",
      type: "number",
      admin: { description: "Weight in kg" },
    },
    {
      name: "secondaryPackaging",
      type: "text",
      admin: { description: "Shipping package material" },
    },
    {
      name: "secondaryWeight",
      type: "number",
      admin: { description: "Weight in kg" },
    },
    {
      name: "totalPackagingEmissions",
      type: "number",
      admin: { description: "Total packaging stage emissions (kg CO2e)" },
    },
    {
      name: "transportOrigin",
      type: "text",
      admin: { description: "Manufacturing location" },
    },
    {
      name: "transportDestination",
      type: "text",
      admin: { description: "Distribution center or customer" },
    },
    {
      name: "transportDistance",
      type: "number",
      admin: { description: "Distance in km" },
    },
    {
      name: "transportMode",
      type: "select",
      options: [
        { label: "Ocean Freight", value: "ocean" },
        { label: "Air Freight", value: "air" },
        { label: "Truck", value: "truck" },
        { label: "Rail", value: "rail" },
      ],
    },
    {
      name: "transportWeightShipped",
      type: "number",
      admin: { description: "Product weight shipped (kg)" },
    },
    {
      name: "transportUnitsShipped",
      type: "number",
      admin: { description: "Number of units in shipment" },
    },
    {
      name: "transportationEmissionsPerUnit",
      type: "number",
      admin: { description: "kg CO2e per unit" },
    },
    {
      name: "eolScenario",
      type: "select",
      options: [
        { label: "Landfill", value: "landfill" },
        { label: "Incineration", value: "incineration" },
        { label: "Recycling", value: "recycling" },
        { label: "Composting", value: "composting" },
      ],
    },
    {
      name: "decompositionTime",
      type: "number",
      admin: { description: "Years to decompose (if applicable)" },
    },
    {
      name: "emissionsFromDecomposition",
      type: "number",
      admin: { description: "kg CO2e from decomposition" },
    },
    {
      name: "recyclingBenefit",
      type: "number",
      admin: { description: "CO2e reduction from recycling (negative value)" },
    },
    {
      name: "totalEndOfLifeEmissions",
      type: "number",
      admin: { description: "Net kg CO2e from end-of-life" },
    },
    {
      name: "totalCarbonFootprint",
      type: "number",
      required: true,
      admin: { description: "Cradle-to-grave total emissions (kg CO2e per unit)" },
    },
    {
      name: "breakdownByStage",
      type: "json",
      admin: { description: "Percentage contribution by lifecycle stage" },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Verified", value: "verified" },
        { label: "Superseded", value: "superseded" },
      ],
      index: true,
    },
    {
      name: "lastCalculatedAt",
      type: "date",
      admin: { description: "When footprint was last calculated" },
    },
    {
      name: "certifications",
      type: "array",
      fields: [
        {
          name: "cert",
          type: "text",
          admin: { description: "e.g., Carbon Trust Standard, Product Carbon Label" },
        },
        {
          name: "certificationDate",
          type: "date",
        },
      ],
    },
    {
      name: "improvements",
      type: "array",
      fields: [
        {
          name: "improvement",
          type: "text",
          required: true,
        },
        {
          name: "potentialReduction",
          type: "number",
          admin: { description: "Potential CO2e reduction (kg)" },
        },
        {
          name: "implementationCost",
          type: "number",
          admin: { description: "Cost to implement in USD" },
        },
      ],
    },
  ],
};
