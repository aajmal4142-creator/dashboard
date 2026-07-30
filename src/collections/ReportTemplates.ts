import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const REPORT_TEMPLATES_SLUG = "report-templates" as const;

export const ReportTemplates: CollectionConfig = {
  slug: REPORT_TEMPLATES_SLUG,
  admin: {
    useAsTitle: "templateName",
    defaultColumns: ["templateName", "purpose", "framework", "type", "isPublic"],
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
      name: "purpose",
      type: "select",
      required: true,
      defaultValue: "report",
      index: true,
      options: [
        { label: "Report layout (F2)", value: "report" },
        { label: "Compliance assessment (F13)", value: "compliance" },
      ],
      admin: {
        description:
          "report = CSRD/layout templates; compliance = questionnaire + calculations assessments",
      },
    },
    {
      name: "industry",
      type: "select",
      index: true,
      options: [
        { label: "General", value: "general" },
        { label: "Oil & Gas", value: "oil_gas" },
        { label: "Manufacturing", value: "manufacturing" },
        { label: "Finance", value: "finance" },
        { label: "Retail", value: "retail" },
      ],
      admin: {
        description: "Industry starter tag for compliance templates",
        condition: (_, siblingData) => siblingData?.purpose === "compliance",
      },
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
          name: "sectionKey",
          type: "text",
          admin: {
            description: "Stable key for compliance questions (e.g. governance)",
          },
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
            { label: "Executive summary", value: "executive_summary" },
            { label: "Scope breakdown", value: "scope_breakdown" },
            { label: "ESRS disclosures", value: "esrs_disclosures" },
            { label: "Data integrity", value: "data_integrity" },
            { label: "Compliance declaration", value: "compliance_declaration" },
            { label: "Questions", value: "questions" },
            { label: "Calculations", value: "calculations" },
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
      name: "questions",
      type: "array",
      admin: {
        description: "Compliance assessment questions (purpose=compliance)",
        condition: (_, siblingData) => siblingData?.purpose === "compliance",
      },
      fields: [
        {
          name: "questionId",
          type: "text",
          required: true,
          admin: { description: "Stable id (e.g. og-methane)" },
        },
        {
          name: "sectionKey",
          type: "text",
          required: true,
        },
        {
          name: "label",
          type: "text",
          required: true,
        },
        {
          name: "prompt",
          type: "textarea",
          required: true,
        },
        {
          name: "answerType",
          type: "select",
          required: true,
          defaultValue: "text",
          options: [
            { label: "Text", value: "text" },
            { label: "Number", value: "number" },
            { label: "Boolean", value: "boolean" },
            { label: "Select", value: "select" },
            { label: "Calculated", value: "calculated" },
          ],
        },
        {
          name: "options",
          type: "json",
          admin: { description: "Select options: string[]" },
        },
        {
          name: "unit",
          type: "text",
          admin: { description: "Display unit for number / calculated answers" },
        },
        {
          name: "required",
          type: "checkbox",
          defaultValue: false,
        },
        {
          name: "order",
          type: "number",
        },
      ],
    },
    {
      name: "calculations",
      type: "array",
      admin: {
        description: "Derived metrics from numeric answers (purpose=compliance)",
        condition: (_, siblingData) => siblingData?.purpose === "compliance",
      },
      fields: [
        {
          name: "calcId",
          type: "text",
          required: true,
        },
        {
          name: "label",
          type: "text",
          required: true,
        },
        {
          name: "op",
          type: "select",
          required: true,
          options: [
            { label: "Sum", value: "sum" },
            { label: "Product", value: "product" },
            { label: "Ratio (a/b)", value: "ratio" },
            { label: "Difference (a−b)", value: "difference" },
          ],
        },
        {
          name: "inputs",
          type: "json",
          required: true,
          admin: {
            description: "Ordered questionId list used by the operation",
          },
        },
        {
          name: "unit",
          type: "text",
        },
        {
          name: "sectionKey",
          type: "text",
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
