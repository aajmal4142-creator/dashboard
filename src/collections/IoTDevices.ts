import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const IOT_DEVICES_SLUG = "iot-devices" as const;

export const IoTDevices: CollectionConfig = {
  slug: IOT_DEVICES_SLUG,
  admin: {
    useAsTitle: "deviceName",
    defaultColumns: ["deviceName", "deviceType", "status", "lastHeartbeat"],
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
      name: "deviceName",
      type: "text",
      required: true,
      admin: { description: "Human-readable device name" },
    },
    {
      name: "deviceId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Unique device identifier (MAC or IMEI)" },
    },
    {
      name: "deviceType",
      type: "select",
      required: true,
      options: [
        { label: "MQTT Sensor", value: "mqtt" },
        { label: "Modbus Device", value: "modbus" },
        { label: "OPC-UA Server", value: "opc_ua" },
        { label: "Utility API (Energy)", value: "utility_energy" },
        { label: "Utility API (Water)", value: "utility_water" },
        { label: "Utility API (Gas)", value: "utility_gas" },
        { label: "Smart Meter", value: "smart_meter" },
      ],
    },
    {
      name: "protocol",
      type: "text",
      admin: { description: "Protocol version (e.g., MQTT v3.1.1)" },
    },
    {
      name: "connectionString",
      type: "text",
      admin: { description: "Connection URL or broker address" },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "disconnected",
      options: [
        { label: "Connected", value: "connected" },
        { label: "Disconnected", value: "disconnected" },
        { label: "Error", value: "error" },
        { label: "Maintenance", value: "maintenance" },
      ],
      index: true,
    },
    {
      name: "lastHeartbeat",
      type: "date",
      admin: { description: "Last successful data transmission" },
    },
    {
      name: "dataPoints",
      type: "array",
      fields: [
        {
          name: "pointName",
          type: "text",
          required: true,
        },
        {
          name: "unit",
          type: "text",
          required: true,
        },
        {
          name: "dataType",
          type: "select",
          options: [
            { label: "Float", value: "float" },
            { label: "Integer", value: "int" },
            { label: "Boolean", value: "bool" },
            { label: "String", value: "string" },
          ],
        },
      ],
    },
    {
      name: "anomalyDetectionEnabled",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Enable anomaly detection for meter failures" },
    },
    {
      name: "anomalyThreshold",
      type: "number",
      defaultValue: 20,
      admin: { description: "Threshold % for anomaly detection" },
    },
    {
      name: "location",
      type: "text",
      admin: { description: "Physical location of meter" },
    },
    {
      name: "installationDate",
      type: "date",
      admin: { description: "When meter was installed" },
    },
    {
      name: "credentials",
      type: "text",
      admin: {
        description: "Encrypted credentials for device access (API key, username)",
      },
    },
  ],
};
