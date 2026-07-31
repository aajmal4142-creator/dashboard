import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const TrendForecasts: CollectionConfig = {
  slug: "trend-forecasts",
  admin: {
    defaultColumns: [
      "scenario",
      "period",
      "forecastedEmissions",
      "confidence",
      "createdAt",
    ],
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
      name: "period",
      type: "text",
      index: true,
      label: "Forecast period label",
      admin: {
        description: "e.g. 2027 or 2025–2027 horizon",
      },
    },
    {
      name: "forecastedEmissions",
      type: "number",
      label: "Forecasted emissions (tCO2e)",
      admin: {
        description:
          "Primary projection for the scenario (usually the final horizon year).",
      },
    },
    {
      name: "confidence",
      type: "select",
      options: [
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      admin: { description: "Data-driven confidence from historical year count." },
    },
    {
      name: "scenario",
      type: "select",
      options: [
        { label: "Conservative (flat)", value: "conservative" },
        { label: "Baseline", value: "baseline" },
        { label: "Aggressive", value: "aggressive" },
      ],
      index: true,
    },
    {
      name: "methodology",
      type: "text",
      defaultValue: "linear_regression_trend_adjusted",
      admin: {
        description: "Calculation method identifier.",
      },
    },
    {
      name: "lastCalculatedAt",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "assumptionsUsed",
      type: "json",
      admin: {
        description:
          "Growth rates, efficiency, interventions, and horizon used for this run.",
      },
    },
    {
      name: "projectionPoints",
      type: "array",
      fields: [
        { name: "year", type: "number", required: true },
        { name: "emissions", type: "number", required: true },
        { name: "lower", type: "number", required: true },
        { name: "upper", type: "number", required: true },
        { name: "reasoning", type: "textarea" },
      ],
    },
    {
      name: "historicalYears",
      type: "array",
      fields: [
        { name: "year", type: "number", required: true },
        { name: "emissions", type: "number", required: true },
      ],
    },
    {
      name: "slopePerYear",
      type: "number",
      admin: { description: "Fitted YoY slope (tCO2e/year)." },
    },
    {
      name: "warnings",
      type: "array",
      fields: [{ name: "message", type: "text", required: true }],
    },
    // —— Legacy ARIMA/ETS fields (kept for existing docs; optional) ——
    {
      name: "metricKey",
      type: "text",
      index: true,
      label: "Metric Key (legacy)",
    },
    {
      name: "model",
      type: "select",
      options: [
        { label: "ARIMA", value: "arima" },
        { label: "ETS (Error-Trend-Seasonal)", value: "ets" },
        { label: "Hybrid", value: "hybrid" },
        { label: "Linear regression (S6.5)", value: "linear_regression" },
      ],
    },
    {
      name: "baselineDate",
      type: "date",
      label: "Forecast baseline date",
    },
    {
      name: "forecastPeriodMonths",
      type: "number",
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
