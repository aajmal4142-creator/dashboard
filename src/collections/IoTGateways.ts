import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const IOT_GATEWAYS_SLUG = "iot-gateways" as const;

/**
 * Multi-gateway orchestration for IoT hubs (MQTT, HTTP webhook, direct, cloud stubs).
 * Credentials are AES-256-GCM encrypted at rest — never return plaintext via API.
 */
export const IoTGateways: CollectionConfig = {
  slug: IOT_GATEWAYS_SLUG,
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "gatewayType",
      "status",
      "lastHeartbeat",
      "lastDataReceived",
    ],
    description: "IoT hubs / gateways — credentials encrypted at rest",
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
      name: "name",
      type: "text",
      required: true,
      admin: { description: 'Human-readable label (e.g. "Office MQTT")' },
    },
    {
      name: "gatewayType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "MQTT Broker", value: "mqtt" },
        { label: "HTTP / REST", value: "http" },
        { label: "HTTP Webhook", value: "webhook" },
        { label: "Direct API (no hub)", value: "direct" },
        { label: "Cloud Platform (free-tier stub)", value: "cloud" },
      ],
    },
    {
      name: "cloudProvider",
      type: "select",
      options: [
        { label: "AWS IoT Core (free tier)", value: "aws_iot" },
        { label: "Azure IoT Hub (free tier)", value: "azure_iot" },
        { label: "Google Cloud IoT (legacy free)", value: "gcp_iot" },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.gatewayType === "cloud",
        description: "Cloud IoT free-tier stub only — no paid APIs",
      },
    },
    {
      name: "endpoint",
      type: "text",
      admin: {
        description: "Broker URL, webhook base URL, or cloud endpoint",
      },
    },
    {
      name: "encryptedCredentials",
      type: "textarea",
      admin: {
        readOnly: true,
        description: "AES-256-GCM ciphertext. Never log or return to clients.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "offline",
      index: true,
      options: [
        { label: "Online", value: "online" },
        { label: "Offline", value: "offline" },
        { label: "Stale", value: "stale" },
        { label: "Error", value: "error" },
      ],
    },
    {
      name: "lastHeartbeat",
      type: "date",
      admin: { description: "Last I'm-alive signal from the gateway" },
    },
    {
      name: "lastDataReceived",
      type: "date",
      admin: { description: "Last reading ingested via a device on this gateway" },
    },
    {
      name: "lastSyncAt",
      type: "date",
      admin: { description: "Last independent sync attempt (per-gateway)" },
    },
    {
      name: "offlineAlertSentAt",
      type: "date",
      admin: {
        readOnly: true,
        description: "When the >30 min offline alert was last raised",
      },
    },
    {
      name: "failoverNote",
      type: "textarea",
      admin: {
        description:
          "Operator note when this gateway is offline and devices should use a peer",
      },
    },
    {
      name: "preferredFailoverGateway",
      type: "relationship",
      relationTo: IOT_GATEWAYS_SLUG,
      admin: {
        description:
          "Preferred peer for same device-type failover when this hub is offline",
      },
    },
    {
      name: "syncIndependent",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Sync this gateway independently of other hubs in the org",
      },
    },
  ],
};
