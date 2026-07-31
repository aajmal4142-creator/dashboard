import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const DATA_QUALITY_RULES_SLUG = "data-quality-rules" as const;

export const DataQualityRules: CollectionConfig = {
  slug: DATA_QUALITY_RULES_SLUG,
  admin: {
    useAsTitle: "ruleName",
    defaultColumns: ["ruleName", "ruleType", "status", "priority"],
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
      name: "ruleName",
      type: "text",
      required: true,
      admin: { description: "Human-readable rule name" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Rule description and business logic" },
    },
    {
      name: "ruleType",
      type: "select",
      required: true,
      options: [
        { label: "Value range", value: "range" },
        { label: "Required field", value: "required" },
        { label: "Pattern match", value: "pattern" },
        { label: "Regex Pattern (legacy)", value: "regex" },
        { label: "Business Logic", value: "business" },
        { label: "Cross-Field", value: "cross_field" },
        { label: "Uniqueness", value: "uniqueness" },
        { label: "Referential Integrity", value: "referential" },
      ],
    },
    {
      name: "appliesTo",
      type: "select",
      required: true,
      options: [
        { label: "Datapoints", value: "datapoints" },
        { label: "Scope3 Activities", value: "scope3" },
        { label: "Supplier Data", value: "supplier" },
        { label: "Emissions Calculations", value: "emissions" },
      ],
    },
    {
      name: "ruleConfig",
      type: "json",
      required: true,
      admin: { description: "Rule configuration (varies by type)" },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Testing", value: "testing" },
      ],
      admin: { description: "Active = enabled. Inactive = disabled." },
    },
    {
      name: "severity",
      type: "select",
      defaultValue: "error",
      options: [
        { label: "Error (blocks approval)", value: "error" },
        { label: "Warning", value: "warning" },
      ],
      admin: { description: "Error blocks datapoint approval; warning is advisory." },
    },
    {
      name: "errorMessage",
      type: "text",
      admin: { description: "Custom message shown when the rule fails" },
    },
    {
      name: "priority",
      type: "select",
      defaultValue: "medium",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
        { label: "Critical", value: "critical" },
      ],
    },
    {
      name: "action",
      type: "select",
      defaultValue: "flag",
      options: [
        { label: "Flag for Review", value: "flag" },
        { label: "Auto-Correct", value: "correct" },
        { label: "Block Submission", value: "block" },
        { label: "Warn User", value: "warn" },
      ],
    },
    {
      name: "version",
      type: "number",
      required: true,
      defaultValue: 1,
      admin: { description: "Rule version for history tracking" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who created this rule" },
    },
    {
      name: "lastModifiedBy",
      type: "relationship",
      relationTo: "users",
      admin: { description: "User who last modified this rule" },
    },
    {
      name: "violationCount",
      type: "number",
      defaultValue: 0,
      admin: { description: "Number of violations detected" },
    },
    {
      name: "testCases",
      type: "array",
      admin: { description: "Test cases for rule validation" },
      fields: [
        {
          name: "testInput",
          type: "json",
          required: true,
        },
        {
          name: "expectedResult",
          type: "select",
          options: [
            { label: "Pass", value: "pass" },
            { label: "Fail", value: "fail" },
          ],
        },
        {
          name: "testPassed",
          type: "checkbox",
        },
      ],
    },
  ],
};
