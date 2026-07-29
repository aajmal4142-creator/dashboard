import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const DecarbonizationPathways: CollectionConfig = {
  slug: "decarbonization-pathways",
  admin: {
    defaultColumns: ["name", "targetYear", "targetReduction", "status"],
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
      label: "Pathway Name",
    },
    {
      name: "description",
      type: "textarea",
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
      name: "baselineEmissions",
      type: "number",
      required: true,
      label: "Baseline emissions (tCO2e)",
    },
    {
      name: "targetEmissions",
      type: "number",
      required: true,
      label: "Target emissions (tCO2e)",
    },
    {
      name: "targetReduction",
      type: "number",
      admin: { readOnly: true },
      label: "Target reduction (%)",
    },
    {
      name: "stages",
      type: "array",
      fields: [
        {
          name: "year",
          type: "number",
          required: true,
        },
        {
          name: "targetEmissions",
          type: "number",
          required: true,
        },
        {
          name: "leversApplied",
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
              name: "emissionReduction",
              type: "number",
            },
            {
              name: "capexRequired",
              type: "number",
            },
          ],
        },
        {
          name: "cumulativeCapex",
          type: "number",
        },
      ],
    },
    {
      name: "scienceBasedTargetAlignment",
      type: "json",
      admin: {
        description: "SBTi target alignment (1.5C, 2C, etc.)",
      },
    },
    {
      name: "status",
      type: "select",
      options: [
        { label: "Draft", value: "draft" },
        { label: "In Progress", value: "in_progress" },
        { label: "Approved", value: "approved" },
        { label: "Completed", value: "completed" },
      ],
      defaultValue: "draft",
    },
    {
      name: "approval",
      type: "group",
      fields: [
        {
          name: "approvedBy",
          type: "relationship",
          relationTo: "users",
        },
        {
          name: "approvedAt",
          type: "date",
        },
      ],
    },
  ],
  timestamps: true,
};
