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
