import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const Suppliers: CollectionConfig = {
  slug: "suppliers",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "organisation", "requestStatus", "annualSpend"],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    { name: "name", type: "text", required: true },
    { name: "contactEmail", type: "email", required: true },
    {
      name: "emailConsent",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: {
        description:
          "Supplier consented to receive engagement / questionnaire emails. Required before send.",
      },
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Purchased goods", value: "purchased_goods" },
        { label: "Capital goods", value: "capital_goods" },
        { label: "Transport", value: "transport" },
        { label: "Waste", value: "waste" },
        { label: "Business travel", value: "business_travel" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "annualSpend", type: "number", min: 0 },
    {
      name: "tier",
      type: "number",
      min: 1,
      max: 3,
      defaultValue: 1,
      index: true,
      admin: {
        description:
          "Supply-chain tier relative to the reporting org: 1 = direct, 2/3 = upstream",
      },
    },
    {
      name: "directSpend",
      type: "number",
      min: 0,
      admin: {
        description:
          "Amount spent by you (or the parent supplier) on this supplier — used for Tier 2/3 allocation",
      },
    },
    {
      name: "naceCode",
      type: "text",
      admin: {
        description:
          "NACE Rev. 2 industry code (section or class). Required for industry-average estimates — never assumed.",
      },
    },
    {
      name: "industryIntensityOverride",
      type: "number",
      min: 0,
      admin: {
        description:
          "Optional override: tCO₂e per $1M USD spend. When set, skips bundled NACE intensity.",
      },
    },
    {
      name: "totalRevenue",
      type: "number",
      min: 0,
      admin: {
        description:
          "Supplier total revenue (USD). When set, allocation = directSpend / totalRevenue.",
      },
    },
    {
      name: "estimatedEmissions",
      type: "number",
      min: 0,
      admin: {
        description:
          "Estimated attributable tCO₂e when no measured supplier data (Tier 2/3 hybrid estimator)",
      },
    },
    {
      name: "estimationMethod",
      type: "select",
      options: [
        { label: "Actual (measured)", value: "actual" },
        { label: "Industry average", value: "industry_avg" },
        { label: "Top-down", value: "top_down" },
      ],
      admin: {
        description: "How estimatedEmissions / attributable figure was derived",
      },
    },
    {
      name: "estimationConfidence",
      type: "select",
      options: [
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      admin: {
        description: "High if actual; low if industry average",
      },
    },
    {
      name: "parentSupplier",
      type: "relationship",
      relationTo: "suppliers",
      admin: {
        description: "Parent Tier-1 (or Tier-2) supplier when this row is Tier 2/3",
      },
    },
    {
      name: "requestPeriod",
      type: "relationship",
      relationTo: "reporting-periods",
      admin: {
        description: "Reporting period this request token is bound to",
      },
    },
    {
      name: "requestToken",
      type: "text",
      unique: true,
      index: true,
    },
    {
      name: "requestStatus",
      type: "select",
      defaultValue: "not_sent",
      options: [
        { label: "Not sent", value: "not_sent" },
        { label: "Sent", value: "sent" },
        { label: "Opened", value: "opened" },
        { label: "Submitted", value: "submitted" },
        { label: "Declined", value: "declined" },
      ],
    },
    { name: "sentAt", type: "date" },
    { name: "requestExpiresAt", type: "date" },
    { name: "respondedAt", type: "date" },
    { name: "lastReminderAt", type: "date" },
    { name: "submittedData", type: "json" },
    { name: "reminderCount", type: "number", defaultValue: 0, min: 0 },
    {
      name: "country",
      type: "text",
      admin: {
        description: "Country code or name (for UN GC, EU ETS matching)",
      },
    },
    {
      name: "esgData",
      type: "group",
      admin: {
        description: "Free ESG data from public sources (UN GC, govt registries)",
      },
      fields: [
        {
          name: "unGcSignatory",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "Is supplier a UN Global Compact signatory?",
          },
        },
        {
          name: "unGcVerifiedAt",
          type: "date",
          admin: {
            description: "When UN GC signatory status was verified",
          },
        },
        {
          name: "hasIso14001",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "ISO 14001 Environmental Management certification",
          },
        },
        {
          name: "hasBCorp",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "B Corp certification",
          },
        },
        {
          name: "certifications",
          type: "json",
          admin: {
            description:
              "Array of certifications with expiry dates: [{name, expiryDate}]",
          },
        },
        {
          name: "dataCompletionPercent",
          type: "number",
          min: 0,
          max: 100,
          defaultValue: 0,
          admin: {
            description: "Percentage of required ESG data collected (0-100)",
          },
        },
        {
          name: "lastDataUpdateAt",
          type: "date",
          admin: {
            description: "When ESG data was last updated from any source",
          },
        },
      ],
    },
    {
      name: "riskMetrics",
      type: "group",
      admin: {
        description:
          "ESG risk score: Environmental 40% + Social 30% + Governance 30% (higher = worse)",
      },
      fields: [
        { name: "score", type: "number", min: 0, max: 100 },
        {
          name: "tier",
          type: "select",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
            { label: "Critical", value: "critical" },
          ],
        },
        {
          name: "environmentalScore",
          type: "number",
          min: 0,
          max: 100,
          admin: { description: "Environmental pillar risk (weight 40%)" },
        },
        {
          name: "socialScore",
          type: "number",
          min: 0,
          max: 100,
          admin: { description: "Social pillar risk (weight 30%)" },
        },
        {
          name: "governanceScore",
          type: "number",
          min: 0,
          max: 100,
          admin: { description: "Governance pillar risk (weight 30%)" },
        },
        {
          name: "flags",
          type: "json",
          admin: {
            description:
              "Risk flags e.g. missing_emissions, yoy_increase, high_risk_alert",
          },
        },
        {
          name: "mitigations",
          type: "json",
          admin: {
            description:
              "Mitigation actions: [{id, action, status, createdAt, completedAt}]",
          },
        },
        { name: "calculatedAt", type: "date" },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, context, operation }) => {
        if (context?.skipRiskRecalc) return doc;
        if (operation !== "create" && operation !== "update") return doc;

        const { supplierNeedsRiskRecalc, calculateRiskScore } =
          await import("@/lib/suppliers/riskScoringEngine");

        const prev = previousDoc as Record<string, unknown> | undefined;
        const next = doc as Record<string, unknown>;
        if (operation === "update" && !supplierNeedsRiskRecalc(prev, next)) {
          return doc;
        }

        // Fire-and-forget recalc so the write path stays responsive.
        void calculateRiskScore(String(doc.id));
        return doc;
      },
    ],
  },
};
