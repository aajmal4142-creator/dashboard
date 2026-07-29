import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const USAGE_METRICS_SLUG = "usage-metrics" as const;

export const UsageMetrics: CollectionConfig = {
  slug: USAGE_METRICS_SLUG,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "subscription",
      "organisation",
      "date",
      "dataPointsCreated",
      "reportsPublished",
      "apiCallsCount",
    ],
  },
  access: tenantAccess({ writeMin: "contributor" }),
  fields: [
    {
      name: "subscription",
      type: "relationship",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relationTo: "subscriptions" as any,
      required: true,
      index: true,
      admin: { description: "Associated subscription" },
    },
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: { description: "Organization for quick filtering" },
    },
    {
      name: "date",
      type: "date",
      required: true,
      index: true,
      admin: { description: "Date of usage (start of day)" },
    },
    {
      name: "dataPointsCreated",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "Datapoints created today" },
    },
    {
      name: "dataPointsCumulative",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "Cumulative datapoints this billing period" },
    },
    {
      name: "reportsPublished",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "Reports published today" },
    },
    {
      name: "reportsCumulative",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "Cumulative reports this billing period" },
    },
    {
      name: "apiCallsCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "API calls made today" },
    },
    {
      name: "storageUsedGB",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "Storage used in GB" },
    },
    {
      name: "activeUsersCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: "Concurrent active users" },
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
      admin: { readOnly: true },
    },
  ],
};
