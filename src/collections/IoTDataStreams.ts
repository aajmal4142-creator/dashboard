import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const IOT_DATA_STREAMS_SLUG = "iot-data-streams" as const;

/**
 * Time-series IoT readings + hourly/daily aggregates.
 * Retention: expiresAt ≈ timestamp + 12 months (enforced on write; purge via retentionCutoff).
 */
export const IoTDataStreams: CollectionConfig = {
  slug: IOT_DATA_STREAMS_SLUG,
  admin: {
    useAsTitle: "sensorType",
    defaultColumns: ["sensorType", "bucket", "value", "timestamp", "isAnomaly"],
    description: "IoT sensor readings and aggregates (≈12 month retention)",
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "device",
      type: "relationship",
      relationTo: "iot-devices",
      required: true,
      index: true,
    },
    {
      name: "sensorType",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "value",
      type: "number",
      required: true,
    },
    {
      name: "unit",
      type: "text",
      required: true,
    },
    {
      name: "timestamp",
      type: "date",
      required: true,
      index: true,
      admin: { description: "Reading time (raw) or bucket start (hourly/daily)" },
    },
    {
      name: "quality",
      type: "select",
      required: true,
      defaultValue: "measured",
      options: [
        { label: "Measured", value: "measured" },
        { label: "Missing", value: "missing" },
      ],
    },
    {
      name: "bucket",
      type: "select",
      required: true,
      defaultValue: "raw",
      index: true,
      options: [
        { label: "Raw", value: "raw" },
        { label: "Hourly", value: "hourly" },
        { label: "Daily", value: "daily" },
      ],
    },
    { name: "sum", type: "number" },
    { name: "count", type: "number" },
    { name: "avg", type: "number" },
    { name: "min", type: "number" },
    { name: "max", type: "number" },
    {
      name: "isAnomaly",
      type: "checkbox",
      defaultValue: false,
      index: true,
    },
    {
      name: "anomalyReason",
      type: "text",
    },
    {
      name: "metricKey",
      type: "text",
      admin: { description: "Mapped datapoint metric key" },
    },
    {
      name: "scope",
      type: "select",
      options: [
        { label: "Scope 1", value: "1" },
        { label: "Scope 2", value: "2" },
        { label: "Scope 3", value: "3" },
      ],
    },
    {
      name: "expiresAt",
      type: "date",
      index: true,
      admin: { description: "Retention expiry (~12 months from reading)" },
    },
  ],
};
