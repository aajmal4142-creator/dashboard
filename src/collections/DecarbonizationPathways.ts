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
      label: "Start / baseline year",
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
      label: "Target emissions (tCO2e; 0 = net-zero)",
    },
    {
      name: "targetReduction",
      type: "number",
      admin: { readOnly: true },
      label: "Target reduction (%)",
    },
    {
      name: "milestones",
      type: "array",
      labels: { singular: "Milestone", plural: "Milestones" },
      fields: [
        {
          name: "year",
          type: "number",
          required: true,
        },
        {
          name: "action",
          type: "text",
          required: true,
        },
        {
          name: "emissionsSaved",
          type: "number",
          required: true,
          label: "Emissions saved (tCO2e)",
        },
        {
          name: "cost",
          type: "number",
          defaultValue: 0,
          label: "Cost",
        },
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "planned",
          options: [
            { label: "Planned", value: "planned" },
            { label: "In progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Missed", value: "missed" },
          ],
        },
        {
          name: "scope",
          type: "select",
          options: [
            { label: "Scope 1", value: "1" },
            { label: "Scope 2", value: "2" },
            { label: "Scope 3", value: "3" },
            { label: "Cross-cutting", value: "cross" },
          ],
          defaultValue: "cross",
        },
        {
          name: "cumulativeEmissionsSaved",
          type: "number",
          admin: { readOnly: true },
        },
        {
          name: "pathwayEmissions",
          type: "number",
          admin: { readOnly: true },
          label: "Pathway emissions after milestone",
        },
      ],
    },
    {
      name: "feasibility",
      type: "group",
      fields: [
        {
          name: "level",
          type: "select",
          options: [
            { label: "Achievable", value: "achievable" },
            { label: "Aggressive", value: "aggressive" },
            { label: "Unrealistic", value: "unrealistic" },
          ],
        },
        {
          name: "requiredAnnualReduction",
          type: "number",
          label: "Required annual reduction (tCO2e)",
        },
        {
          name: "requiredAnnualReductionPercent",
          type: "number",
          label: "Required annual reduction (%)",
        },
        {
          name: "peerTypicalAnnualPercent",
          type: "number",
        },
        {
          name: "warning",
          type: "textarea",
        },
        {
          name: "message",
          type: "text",
        },
      ],
    },
    {
      name: "costEstimate",
      type: "number",
      label: "Total cost estimate",
    },
    {
      name: "stages",
      type: "array",
      admin: {
        description: "Derived stage targets (compat with scenario levers view).",
      },
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
      name: "timeline",
      type: "array",
      admin: { description: "Year-by-year baseline hold vs pathway emissions." },
      fields: [
        { name: "year", type: "number", required: true },
        { name: "baselineHold", type: "number", required: true },
        { name: "pathwayEmissions", type: "number", required: true },
        { name: "isMilestone", type: "checkbox", defaultValue: false },
      ],
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
