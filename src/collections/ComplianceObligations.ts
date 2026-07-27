import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

/**
 * Per-org compliance deadline source of truth.
 * Phase 5 Compliance Runway reads from here — never hardcode dates.
 * Phase 1: filingDeadline is optional (null = voluntary / not in mandatory scope).
 */
export const ComplianceObligations: CollectionConfig = {
  slug: "compliance-obligations",
  admin: {
    useAsTitle: "standardVersion",
    defaultColumns: [
      "organisation",
      "jurisdiction",
      "standardVersion",
      "wave",
      "filingDeadline",
      "confidence",
      "source",
    ],
  },
  access: tenantAccess({ writeMin: "admin", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "wave",
      type: "select",
      required: true,
      options: [
        { label: "Wave 1", value: "1" },
        { label: "Wave 2", value: "2" },
        { label: "Wave 3", value: "3" },
        { label: "BRSR listed", value: "brsr_listed" },
        { label: "BRSR supply chain", value: "brsr_supply" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "jurisdiction",
      type: "text",
      required: true,
      admin: { description: "ISO country or region code, e.g. EU, IN, GB" },
    },
    {
      name: "standardVersion",
      type: "select",
      required: true,
      options: [
        { label: "CSRD Set 1", value: "CSRD_SET1" },
        { label: "CSRD Simplified", value: "CSRD_SIMPLIFIED" },
        { label: "BRSR", value: "BRSR" },
        { label: "VSME", value: "VSME" },
        { label: "GRI", value: "GRI" },
      ],
    },
    {
      name: "firstReportingFY",
      type: "text",
      required: true,
      admin: { description: 'e.g. "FY2025" or "2025-26"' },
    },
    {
      name: "filingDeadline",
      type: "date",
      required: false,
      admin: {
        description:
          "Countdown the Compliance Runway displays. Leave empty for voluntary / not in mandatory scope — never invent a date.",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    { name: "notes", type: "textarea" },
    {
      name: "derivationReason",
      type: "textarea",
      admin: {
        description: "Plain-language why this obligation was derived or overridden",
      },
    },
    {
      name: "confidence",
      type: "select",
      options: [
        { label: "Derived", value: "derived" },
        { label: "Needs confirmation", value: "needs_confirmation" },
      ],
      admin: {
        description:
          "needs_confirmation surfaces a gentle Runway prompt; derived is still confirmable, never legal advice",
      },
    },
    {
      name: "source",
      type: "select",
      options: [
        { label: "Engine", value: "engine" },
        { label: "Manual", value: "manual" },
      ],
      admin: {
        description:
          "Manual overrides are sticky on baseline change — do not silently overwrite",
      },
    },
    {
      name: "confirmedAt",
      type: "date",
      admin: {
        description: "When an Owner/Admin confirmed or overrode the obligation",
      },
    },
    {
      name: "derivedInputs",
      type: "group",
      admin: {
        description: "Baseline snapshot used at last engine derivation",
      },
      fields: [
        { name: "country", type: "text" },
        { name: "headcount", type: "number" },
        {
          name: "revenueBand",
          type: "select",
          options: [
            { label: "< €2m", value: "lt_2m" },
            { label: "€2–10m", value: "2_10m" },
            { label: "€10–50m", value: "10_50m" },
            { label: "€50–250m", value: "50_250m" },
            { label: "> €250m", value: "gt_250m" },
          ],
        },
        {
          name: "asOf",
          type: "date",
          admin: { date: { pickerAppearance: "dayOnly" } },
        },
      ],
    },
  ],
};
