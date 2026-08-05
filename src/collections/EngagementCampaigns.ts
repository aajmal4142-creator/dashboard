import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const ENGAGEMENT_CAMPAIGNS_SLUG = "engagement-campaigns" as const;

/**
 * Employee climate-action campaigns (F34).
 * Lightweight participation tracking — no HRIS or messaging BSP.
 */
export const EngagementCampaigns: CollectionConfig = {
  slug: ENGAGEMENT_CAMPAIGNS_SLUG,
  admin: {
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "status",
      "goalType",
      "goalValue",
      "participantCount",
      "startDate",
      "endDate",
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
      name: "title",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      name: "startDate",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Campaign start date.",
      },
    },
    {
      name: "endDate",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Campaign end date.",
      },
    },
    {
      name: "goalType",
      type: "select",
      required: true,
      defaultValue: "participants",
      options: [
        { label: "Participants", value: "participants" },
        { label: "tCO₂e avoided", value: "tco2e" },
      ],
      admin: {
        description: "Goal is a participant count or an emissions avoidance target.",
      },
    },
    {
      name: "goalValue",
      type: "number",
      min: 0,
      admin: {
        description:
          "Target participants or tCO₂e. Leave empty until set — progress quality is missing without a goal.",
      },
    },
    {
      name: "participantCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description:
          "Recorded participation count. Increment via the participate action.",
      },
    },
    {
      name: "achievedTco2e",
      type: "number",
      min: 0,
      admin: {
        description:
          "Measured / claimed tCO₂e avoided toward a tCO₂e goal. Leave empty until known.",
      },
    },
    {
      name: "linkCommuteChallenge",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "When enabled, UI links to Scope 3 travel & commute metrics for commute challenges.",
      },
    },
    {
      name: "description",
      type: "textarea",
      admin: {
        description: "Optional campaign brief shown to organisers.",
      },
    },
    {
      name: "publicToken",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description:
          "Auto-generated when the campaign is created or activated. Powers the public /e/[token] survey link — never guessable, never reused.",
      },
    },
    {
      name: "surveyMode",
      type: "select",
      defaultValue: "none",
      options: [
        { label: "No public survey", value: "none" },
        { label: "Commute survey (days/km)", value: "commute" },
      ],
      admin: {
        description: "Enables a public, tokenised survey form for this campaign.",
      },
    },
    {
      name: "surveyResponseCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description:
          "Count of public survey submissions received via the /e/[token] link.",
      },
    },
  ],
  timestamps: true,
};
