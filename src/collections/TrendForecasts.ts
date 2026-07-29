import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const TrendForecasts: CollectionConfig = {
  slug: "trend-forecasts",
  admin: {
    defaultColumns: ["metricKey", "model", "trendDirection", "createdAt"],
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
      name: "metricKey",
      type: "text",
      required: true,
      index: true,
      label: "Metric Key",
    },
    {
      name: "model",
      type: "select",
      options: [
        { label: "ARIMA", value: "arima" },
        { label: "ETS (Error-Trend-Seasonal)", value: "ets" },
        { label: "Hybrid", value: "hybrid" },
      ],
      required: true,
    },
    {
      name: "baselineDate",
      type: "date",
      required: true,
      label: "Forecast baseline date",
    },
    {
      name: "forecastPeriodMonths",
      type: "number",
      required: true,
      defaultValue: 12,
    },
    {
      name: "forecastData",
      type: "array",
      fields: [
        {
          name: "month",
          type: "number",
          required: true,
        },
        {
          name: "date",
          type: "date",
          required: true,
        },
        {
          name: "forecast",
          type: "number",
          required: true,
        },
        {
          name: "lowerBound80",
          type: "number",
          label: "80% confidence lower bound",
        },
        {
          name: "upperBound80",
          type: "number",
          label: "80% confidence upper bound",
        },
        {
          name: "lowerBound95",
          type: "number",
          label: "95% confidence lower bound",
        },
        {
          name: "upperBound95",
          type: "number",
          label: "95% confidence upper bound",
        },
      ],
    },
    {
      name: "historicalData",
      type: "array",
      fields: [
        {
          name: "date",
          type: "date",
          required: true,
        },
        {
          name: "actualValue",
          type: "number",
          required: true,
        },
      ],
    },
    {
      name: "accuracy",
      type: "group",
      fields: [
        {
          name: "rmse",
          type: "number",
          label: "Root Mean Square Error",
        },
        {
          name: "mae",
          type: "number",
          label: "Mean Absolute Error",
        },
        {
          name: "mape",
          type: "number",
          label: "Mean Absolute Percentage Error",
        },
      ],
    },
    {
      name: "trendDirection",
      type: "select",
      options: [
        { label: "Increasing", value: "increasing" },
        { label: "Decreasing", value: "decreasing" },
        { label: "Stable", value: "stable" },
      ],
      admin: { readOnly: true },
    },
    {
      name: "seasonalityDetected",
      type: "checkbox",
      defaultValue: false,
    },
  ],
  timestamps: true,
};
