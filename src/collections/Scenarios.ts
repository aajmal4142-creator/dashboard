import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const Scenarios: CollectionConfig = {
  slug: "scenarios",
  admin: {
    defaultColumns: ["name", "type", "targetYear", "baselineYear", "createdAt"],
    preview: () => null,
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      hasMany: false,
      admin: { hidden: true },
    },
    {
      name: "name",
      type: "text",
      required: true,
      label: "Scenario Name",
    },
    {
      name: "type",
      type: "select",
      options: [
        { label: "Baseline", value: "baseline" },
        { label: "Optimistic", value: "optimistic" },
        { label: "Pessimistic", value: "pessimistic" },
        { label: "Custom", value: "custom" },
      ],
      required: true,
      defaultValue: "custom",
    },
    {
      name: "baselineYear",
      type: "number",
      required: true,
    },
    {
      name: "targetYear",
      type: "number",
      required: true,
    },
    {
      name: "reductionPercent",
      type: "number",
      label: "Reduction %",
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: { description: "Percent reduction applied to selected scopes." },
    },
    {
      name: "scopes",
      type: "select",
      hasMany: true,
      options: [
        { label: "Scope 1", value: "1" },
        { label: "Scope 2", value: "2" },
        { label: "Scope 3", value: "3" },
      ],
      defaultValue: ["1", "2", "3"],
      admin: { description: "Scopes the reduction applies to." },
    },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Renewable energy", value: "renewable" },
        { label: "Efficiency", value: "efficiency" },
        { label: "Behavior", value: "behavior" },
        { label: "Fuel switching", value: "fuel_switching" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "other",
    },
    {
      name: "timelineYears",
      type: "number",
      label: "Timeline (years)",
      min: 1,
      defaultValue: 5,
    },
    {
      name: "capex",
      type: "number",
      label: "Capex (optional)",
      defaultValue: 0,
    },
    {
      name: "costPerTco2e",
      type: "number",
      label: "Cost per tCO2e avoided (optional)",
      admin: {
        description: "When set, cost-benefit (savings, ROI, payback) is calculated.",
      },
    },
    {
      name: "variables",
      type: "array",
      fields: [
        {
          name: "leverId",
          type: "text",
          required: true,
        },
        {
          name: "leverName",
          type: "text",
          required: true,
        },
        {
          name: "currentValue",
          type: "number",
          required: true,
        },
        {
          name: "targetValue",
          type: "number",
          required: true,
        },
        {
          name: "capexRequired",
          type: "number",
          defaultValue: 0,
        },
        {
          name: "paybackYears",
          type: "number",
        },
        {
          name: "implementationTimeline",
          type: "number",
          label: "Years to implement",
          defaultValue: 1,
        },
        {
          name: "effectiveness",
          type: "number",
          label: "Effectiveness (0–1)",
          min: 0,
          max: 1,
          admin: {
            description:
              "Optional injected effectiveness vs applicable baseline. Omit for 1:1 mapping.",
          },
        },
      ],
    },
    {
      name: "assumptions",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "value",
          type: "number",
          required: true,
        },
      ],
    },
    {
      name: "results",
      type: "json",
      admin: { readOnly: true },
    },
    {
      name: "versionNumber",
      type: "number",
      defaultValue: 1,
      admin: { hidden: true },
    },
    {
      name: "status",
      type: "select",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Calculated", value: "calculated" },
        { label: "Approved", value: "approved" },
      ],
      defaultValue: "draft",
    },
  ],
  timestamps: true,
};
