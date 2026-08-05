import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const BASE_YEAR_RESTATEMENTS_SLUG = "base-year-restatements" as const;

const inventoryGroupFields = [
  {
    name: "scope1",
    type: "number" as const,
    admin: {
      description:
        "Scope 1 total (tCO₂e). Leave empty when unknown — never coerce to zero.",
    },
  },
  {
    name: "scope2",
    type: "number" as const,
    admin: { description: "Scope 2 total (tCO₂e). Leave empty when unknown." },
  },
  {
    name: "scope3",
    type: "number" as const,
    admin: { description: "Scope 3 total (tCO₂e). Leave empty when unknown." },
  },
  {
    name: "quality",
    type: "select" as const,
    required: true,
    defaultValue: "missing",
    options: [
      { label: "Measured", value: "measured" },
      { label: "Missing", value: "missing" },
    ],
  },
  {
    name: "source",
    type: "text" as const,
    admin: { description: "Provenance label (e.g. report:id or manual)." },
  },
  {
    name: "capturedAt",
    type: "date" as const,
    admin: { date: { pickerAppearance: "dayAndTime" as const } },
  },
];

/**
 * GHG Protocol Corporate Standard §12 base-year restatement events.
 * Draft → final workflow; final rows are append-only from the app APIs.
 */
export const BaseYearRestatements: CollectionConfig = {
  slug: BASE_YEAR_RESTATEMENTS_SLUG,
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "reason", "status", "baseYearPeriod", "updatedAt"],
    description:
      "Structural-change restatements of the organisational base-year inventory (acquisition, boundary, methodology).",
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "reason",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Acquisition", value: "acquisition" },
        { label: "Divestiture", value: "divestiture" },
        { label: "Merger", value: "merger" },
        { label: "Methodology change", value: "methodology_change" },
        { label: "Boundary change", value: "boundary_change" },
        { label: "Outsourcing / insourcing", value: "outsourcing_insourcing" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "reasonDetail",
      type: "textarea",
      required: true,
      admin: {
        description:
          "Narrative describing the structural change and why restatement is required.",
      },
    },
    {
      name: "methodologyNote",
      type: "textarea",
      required: true,
      admin: {
        description:
          "How the base year was recalculated (scopes, factors, consolidation approach).",
      },
    },
    {
      name: "effectivePeriod",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
      admin: {
        description: "Reporting period in which the structural change took effect.",
      },
    },
    {
      name: "baseYearPeriod",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
      admin: {
        description: "Base-year reporting period being restated.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Final", value: "final" },
      ],
    },
    {
      name: "priorInventory",
      type: "group",
      admin: {
        description: "Prior (published) base-year inventory snapshot before restatement.",
      },
      fields: inventoryGroupFields,
    },
    {
      name: "restatedInventory",
      type: "group",
      admin: {
        description: "Restated base-year inventory after applying the structural change.",
      },
      fields: inventoryGroupFields,
    },
    {
      name: "comparisonJson",
      type: "json",
      admin: {
        description:
          "Cached prior→restated scope deltas from compareBaseYearInventories.",
      },
    },
    {
      name: "disclosureNote",
      type: "textarea",
      admin: {
        description: "Disclosure-package note generated on finalise.",
      },
    },
    {
      name: "auditNarrative",
      type: "textarea",
      admin: {
        description: "Datapoint version-history narrative for the base-year period.",
      },
    },
    {
      name: "finalizedAt",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayAndTime" },
        readOnly: true,
      },
    },
    {
      name: "appliedAt",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayAndTime" },
        readOnly: true,
        description:
          "Set when finalised — marks the restatement as the applied base-year inventory.",
      },
    },
    {
      name: "finalizedBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
};
