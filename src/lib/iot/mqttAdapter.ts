import type { IotIngestPayload } from "./types";

/**
 * Thin MQTT → REST ingest adapter. No broker lifecycle — callers push messages here.
 */
export function mqttMessageToIngestPayload(input: {
  topic: string;
  payload: string | Record<string, unknown>;
  deviceIdFallback?: string;
}): IotIngestPayload | { error: string } {
  let body: Record<string, unknown>;
  if (typeof input.payload === "string") {
    try {
      body = JSON.parse(input.payload) as Record<string, unknown>;
    } catch {
      return { error: "MQTT payload is not valid JSON" };
    }
  } else {
    body = input.payload;
  }

  const topicParts = input.topic.split("/").filter(Boolean);
  const deviceIdFromTopic =
    topicParts.length >= 2 ? topicParts[topicParts.length - 2] : topicParts[0];

  const deviceId =
    (typeof body.deviceId === "string" && body.deviceId) ||
    input.deviceIdFallback ||
    deviceIdFromTopic ||
    "";

  const sensorType =
    (typeof body.sensorType === "string" && body.sensorType) ||
    (typeof body.metric === "string" && body.metric) ||
    topicParts[topicParts.length - 1] ||
    "";

  const unit = typeof body.unit === "string" ? body.unit : "";
  const value = body.value;
  const timestamp =
    typeof body.timestamp === "string"
      ? body.timestamp
      : typeof body.ts === "string"
        ? body.ts
        : undefined;

  if (!deviceId) return { error: "Could not resolve deviceId from MQTT message" };
  if (!sensorType) return { error: "Could not resolve sensorType from MQTT message" };

  return {
    deviceId,
    sensorType,
    value,
    unit,
    timestamp,
  };
}
