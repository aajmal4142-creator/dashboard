import { NextResponse } from "next/server";

import {
  extractDeviceApiKey,
  ingestIotReading,
  mqttMessageToIngestPayload,
} from "@/lib/iot";

/**
 * POST /api/app/iot/ingest
 * Device-authenticated ingest: { deviceId, sensorType, value, unit, timestamp }
 * Optional MQTT-shaped body: { mqtt: { topic, payload } } converted via thin adapter.
 * Auth: X-Device-Api-Key or Authorization: Bearer <device-api-key>
 */
export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const apiKey = extractDeviceApiKey(request.headers);

    let ingestBody: {
      deviceId?: string;
      sensorType?: string;
      value?: unknown;
      unit?: string;
      timestamp?: string;
      periodId?: string;
    };

    if (raw.mqtt && typeof raw.mqtt === "object") {
      const mqtt = raw.mqtt as { topic?: string; payload?: unknown };
      if (!mqtt.topic || mqtt.payload == null) {
        return NextResponse.json(
          { error: "mqtt.topic and mqtt.payload are required" },
          { status: 400 },
        );
      }
      const adapted = mqttMessageToIngestPayload({
        topic: mqtt.topic,
        payload:
          typeof mqtt.payload === "string" ||
          (typeof mqtt.payload === "object" && mqtt.payload !== null)
            ? (mqtt.payload as string | Record<string, unknown>)
            : String(mqtt.payload),
      });
      if ("error" in adapted) {
        return NextResponse.json({ error: adapted.error }, { status: 400 });
      }
      ingestBody = {
        ...adapted,
        periodId: typeof raw.periodId === "string" ? raw.periodId : undefined,
      };
    } else if (Array.isArray(raw.dataPoints)) {
      // Legacy multi-point shape → reject with guidance (single reading AC)
      return NextResponse.json(
        {
          error:
            "Legacy dataPoints[] is no longer accepted. Send { deviceId, sensorType, value, unit, timestamp }.",
        },
        { status: 400 },
      );
    } else {
      ingestBody = {
        deviceId: typeof raw.deviceId === "string" ? raw.deviceId : undefined,
        sensorType: typeof raw.sensorType === "string" ? raw.sensorType : undefined,
        value: raw.value,
        unit: typeof raw.unit === "string" ? raw.unit : undefined,
        timestamp: typeof raw.timestamp === "string" ? raw.timestamp : undefined,
        periodId: typeof raw.periodId === "string" ? raw.periodId : undefined,
      };
    }

    if (!ingestBody.deviceId || !ingestBody.sensorType || ingestBody.unit == null) {
      return NextResponse.json(
        { error: "deviceId, sensorType, value, and unit are required" },
        { status: 400 },
      );
    }

    const result = await ingestIotReading({
      apiKey,
      payload: {
        deviceId: ingestBody.deviceId,
        sensorType: ingestBody.sensorType,
        value: ingestBody.value,
        unit: ingestBody.unit,
        timestamp: ingestBody.timestamp,
        periodId: ingestBody.periodId,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("IoT ingest error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
