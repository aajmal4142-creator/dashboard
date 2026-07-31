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
        { label: "HTTP / REST sensor", value: "http" },
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
      name: "gateway",
      type: "relationship",
      relationTo: "iot-gateways",
      index: true,
      admin: {
        description: "IoT hub / gateway this device is assigned to (multi-gateway orgs)",
      },
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
      defaultValue: "offline",
      options: [
        { label: "Online", value: "online" },
        { label: "Offline", value: "offline" },
        { label: "Connected (legacy)", value: "connected" },
        { label: "Disconnected (legacy)", value: "disconnected" },
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
      name: "offlineAfterMinutes",
      type: "number",
      defaultValue: 60,
      admin: {
        description: "Mark offline when no heartbeat for this many minutes",
      },
    },
    {
      name: "retentionDays",
      type: "number",
      defaultValue: 365,
      admin: { description: "Stream retention policy (~12 months default)" },
    },
    {
      name: "apiKeyHash",
      type: "text",
      admin: {
        readOnly: true,
        description: "SHA-256 of device API key (never store plaintext)",
      },
    },
    {
      name: "apiKeyPrefix",
      type: "text",
      admin: {
        readOnly: true,
        description: "First characters of API key for identification",
      },
    },
    {
      name: "sensorMappings",
      type: "array",
      admin: {
        description: "Map sensorType → emissions metric / scope (overrides defaults)",
      },
      fields: [
        {
          name: "sensorType",
          type: "text",
          required: true,
        },
        {
          name: "metricKey",
          type: "text",
          required: true,
          admin: { description: "Datapoint metric key (e.g. electricity_kwh)" },
        },
        {
          name: "unit",
          type: "text",
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
      ],
    },
    {
      name: "dataPoints",
      type: "array",
      admin: { description: "Legacy point definitions (prefer sensorMappings)" },
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
      admin: {
        description:
          "Legacy % threshold (detection now uses 3σ / 3× baseline in lib/iot)",
      },
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
        description: "Deprecated plaintext field — use apiKeyHash / rotate via API",
      },
    },
  ],
};
