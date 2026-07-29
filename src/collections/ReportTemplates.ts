import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const REPORT_TEMPLATES_SLUG = "report-templates" as const;

export const ReportTemplates: CollectionConfig = {
  slug: REPORT_TEMPLATES_SLUG,
  admin: {
    useAsTitle: "templateName",
    defaultColumns: ["templateName", "framework", "type", "isPublic"],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      admin: { description: "Org that owns this template (null = system template)" },
    },
    {
      name: "templateName",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "framework",
      type: "select",
      required: true,
      options: [
        { label: "CSRD", value: "csrd" },
        { label: "BRSR", value: "brsr" },
        { label: "GRI", value: "gri" },
        { label: "SASB", value: "sasb" },
        { label: "Custom", value: "custom" },
      ],
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "HTML Interactive", value: "html" },
        { label: "PDF", value: "pdf" },
        { label: "Excel", value: "excel" },
        { label: "PowerPoint", value: "pptx" },
        { label: "JSON", value: "json" },
      ],
    },
    {
      name: "sections",
      type: "array",
      fields: [
        {
          name: "sectionTitle",
          type: "text",
          required: true,
        },
        {
          name: "sectionType",
          type: "select",
          required: true,
          options: [
            { label: "Text", value: "text" },
            { label: "Chart", value: "chart" },
            { label: "Table", value: "table" },
            { label: "Narrative", value: "narrative" },
            { label: "Dynamic", value: "dynamic" },
          ],
        },
        {
          name: "chartConfig",
          type: "json",
          admin: { description: "Chart configuration (if type=chart)" },
        },
        {
          name: "tableColumns",
          type: "json",
          admin: { description: "Column definitions (if type=table)" },
        },
        {
          name: "dataSource",
          type: "text",
          admin: { description: "Data source path or query" },
        },
        {
          name: "order",
          type: "number",
        },
      ],
    },
    {
      name: "templateConfig",
      type: "json",
      admin: { description: "Template configuration (styling, layout, etc.)" },
    },
    {
      name: "htmlTemplate",
      type: "textarea",
      admin: { description: "HTML template code (if type=html)" },
    },
    {
      name: "excelTemplate",
      type: "relationship",
      relationTo: "media",
      admin: { description: "Excel template file (if type=excel)" },
    },
    {
      name: "variables",
      type: "array",
      fields: [
        {
          name: "varName",
          type: "text",
          required: true,
          admin: { description: "Variable name (e.g., company_name)" },
        },
        {
          name: "displayName",
          type: "text",
          required: true,
        },
        {
          name: "type",
          type: "select",
          options: [
            { label: "Text", value: "text" },
            { label: "Number", value: "number" },
            { label: "Date", value: "date" },
            { label: "List", value: "list" },
          ],
        },
        {
          name: "required",
          type: "checkbox",
        },
      ],
    },
    {
      name: "isPublic",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Available to all organizations" },
    },
    {
      name: "usageCount",
      type: "number",
      defaultValue: 0,
      admin: { description: "Number of times this template has been used" },
    },
    {
      name: "version",
      type: "number",
      defaultValue: 1,
      admin: { description: "Template version" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
};
