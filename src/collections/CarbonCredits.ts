import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const CARBON_CREDITS_SLUG = "carbon-credits" as const;

/**
 * Carbon credit / offset lots for residual emissions tracking.
 * User-entered ledger only — not energy certificates (RECs/GOs are F7).
 * ClearESG is not a credit marketplace and does not sync paid registries.
 */
export const CarbonCredits: CollectionConfig = {
  slug: CARBON_CREDITS_SLUG,
  admin: {
    useAsTitle: "label",
    defaultColumns: [
      "creditType",
      "volumeTco2e",
      "vintageYear",
      "status",
      "registryName",
      "updatedAt",
    ],
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
      name: "label",
      type: "text",
      admin: {
        description:
          "Optional display label. Falls back to type + vintage + registry in UI.",
      },
    },
    {
      name: "creditType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Avoidance", value: "avoidance" },
        { label: "Removal", value: "removal" },
        { label: "Mixed", value: "mixed" },
        { label: "Other", value: "other" },
      ],
      admin: {
        description:
          "Offset lot category. Not an energy certificate (REC / GO / EAC) — those live under Energy certificates.",
      },
    },
    {
      name: "volumeTco2e",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Credit volume in tonnes CO₂e.",
      },
    },
    {
      name: "vintageYear",
      type: "number",
      required: true,
      min: 1990,
      max: 2100,
      index: true,
      admin: { description: "Vintage year of the credit lot." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "held",
      index: true,
      options: [
        { label: "Held", value: "held" },
        { label: "Retired", value: "retired" },
      ],
      admin: {
        description:
          "Only retired volume reduces residual emissions. Held volume stays in inventory.",
      },
    },
    {
      name: "registryName",
      type: "text",
      required: true,
      admin: {
        description:
          "Free-text registry or programme name (e.g. Verra VCS, Gold Standard). No paid registry sync.",
      },
    },
    {
      name: "serial",
      type: "text",
      admin: {
        description: "Optional serial / batch identifier from the registry.",
      },
    },
    {
      name: "projectName",
      type: "text",
      admin: {
        description:
          "Project name backing this credit lot (recommended for claim disclosure).",
      },
    },
    {
      name: "projectId",
      type: "text",
      admin: {
        description:
          "Registry project id / reference (recommended for claim disclosure).",
      },
    },
    {
      name: "methodology",
      type: "text",
      admin: {
        description:
          "Crediting methodology / protocol (e.g. VM0042, Gold Standard AR-AMS).",
      },
    },
    {
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      index: true,
      admin: {
        description: "Optional reporting period this retirement or holding applies to.",
      },
    },
    {
      name: "retiredAt",
      type: "date",
      admin: {
        description: "Optional retirement date when status is retired.",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "notes",
      type: "textarea",
    },
  ],
  timestamps: true,
};
