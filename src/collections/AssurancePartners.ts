import type { CollectionConfig } from "payload";

import { denyAll } from "@/lib/access";

export const ASSURANCE_PARTNERS_SLUG = "assurance-partners" as const;

export const FIRM_TYPE_OPTIONS = [
  { label: "Big 4", value: "big4" },
  { label: "Mid-tier", value: "mid_tier" },
  { label: "Specialist", value: "specialist" },
] as const;

export const AssurancePartners: CollectionConfig = {
  slug: ASSURANCE_PARTNERS_SLUG,
  admin: {
    useAsTitle: "firmName",
    defaultColumns: ["firmName", "firmType", "country", "rating", "availability"],
    description:
      "Curated ESG assurance firm directory. Seeded statically — not a live marketplace.",
  },
  access: {
    read: () => true,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    {
      name: "firmName",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "firmType",
      type: "select",
      required: true,
      defaultValue: "specialist",
      index: true,
      options: [...FIRM_TYPE_OPTIONS],
      admin: {
        description: "Big 4 / Mid-tier / Specialist",
      },
    },
    {
      name: "website",
      type: "text",
      required: true,
    },
    {
      name: "contactEmail",
      type: "email",
      required: true,
      admin: {
        description:
          "Directory contact only. Seed uses example.com placeholders — not live inboxes.",
      },
    },
    {
      name: "phone",
      type: "text",
      required: true,
    },
    {
      name: "location",
      type: "text",
      required: true,
      admin: { description: "Primary office location" },
    },
    {
      name: "country",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Primary country code (ISO-ish, e.g. IN, GB, US)",
      },
    },
    {
      name: "countries",
      type: "array",
      admin: {
        description: "All countries where the firm offers ESG assurance",
      },
      fields: [
        {
          name: "code",
          type: "text",
          required: true,
          index: true,
        },
      ],
    },
    {
      name: "certifications",
      type: "array",
      required: true,
      fields: [
        {
          name: "cert",
          type: "select",
          required: true,
          index: true,
          options: [
            { label: "ISO 14064-2", value: "iso_14064_2" },
            { label: "CSRD", value: "csrd" },
            { label: "BRSR", value: "brsr" },
            { label: "GRI", value: "gri" },
            { label: "SASB", value: "sasb" },
            { label: "Science Based Targets", value: "sbt" },
          ],
        },
        {
          name: "certifiedYear",
          type: "number",
        },
      ],
    },
    {
      name: "specializations",
      type: "array",
      fields: [
        {
          name: "spec",
          type: "text",
          required: true,
          index: true,
          admin: { description: "e.g., Energy, Transport, Manufacturing" },
        },
      ],
    },
    {
      name: "teamSize",
      type: "number",
      admin: { description: "Number of consultants" },
    },
    {
      name: "yearsInBusiness",
      type: "number",
      admin: { description: "Years of experience" },
    },
    {
      name: "rating",
      type: "number",
      min: 0,
      max: 5,
      admin: { description: "Average rating from past clients" },
    },
    {
      name: "completedEngagements",
      type: "number",
      defaultValue: 0,
      admin: { description: "Number of completed audit engagements" },
    },
    {
      name: "reviews",
      type: "array",
      fields: [
        {
          name: "rating",
          type: "number",
          required: true,
          min: 1,
          max: 5,
        },
        {
          name: "review",
          type: "textarea",
        },
        {
          name: "organisation",
          type: "text",
        },
        {
          name: "date",
          type: "date",
          required: true,
        },
      ],
    },
    {
      name: "pricing",
      type: "json",
      admin: { description: "Service pricing structure" },
    },
    {
      name: "slaTerms",
      type: "json",
      admin: {
        description: "Service Level Agreement terms (response time, availability)",
      },
    },
    {
      name: "availability",
      type: "select",
      defaultValue: "available",
      options: [
        { label: "Available", value: "available" },
        { label: "Limited Capacity", value: "limited" },
        { label: "Fully Booked", value: "booked" },
      ],
    },
    {
      name: "leadTime",
      type: "number",
      admin: { description: "Engagement lead time in days" },
    },
  ],
};
