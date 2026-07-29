import { getPayload } from "payload";
import { NextResponse } from "next/server";
import config from "@/payload.config";
import type { IotDevice } from "@/payload-types";

type DeviceDataPoint = NonNullable<IotDevice["dataPoints"]>[number];

type IngestPoint = {
  name: string;
  value: number;
};

function orgIdOf(value: IotDevice["organisation"]): string {
  return typeof value === "string" ? value : value.id;
}

/**
 * POST /api/app/iot/ingest
 * Receive real-time data from IoT devices (MQTT, HTTP webhook, etc.)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceId?: string;
      dataPoints?: IngestPoint[];
      timestamp?: string;
      periodId?: string;
    };
    const { deviceId, dataPoints, timestamp, periodId } = body;

    if (!deviceId || !dataPoints) {
      return NextResponse.json(
        { error: "deviceId and dataPoints are required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    // Find device
    const devices = await payload.find({
      collection: "iot-devices",
      where: { deviceId: { equals: deviceId } },
      limit: 1,
    });

    if (!devices.docs?.[0]) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const device = devices.docs[0];
    const orgId = orgIdOf(device.organisation);

    // Update device heartbeat
    await payload.update({
      collection: "iot-devices",
      id: device.id,
      data: {
        status: "connected",
        lastHeartbeat: new Date().toISOString(),
      },
    });

    // Resolve reporting period (required by datapoints schema)
    let resolvedPeriodId = periodId;
    if (!resolvedPeriodId) {
      const periods = await payload.find({
        collection: "reporting-periods",
        where: {
          organisation: { equals: orgId },
          status: { equals: "open" },
        },
        sort: "-createdAt",
        limit: 1,
      });
      resolvedPeriodId = periods.docs[0]?.id;
    }

    if (!resolvedPeriodId) {
      return NextResponse.json(
        { error: "No open reporting period found. Pass periodId or open a period." },
        { status: 400 },
      );
    }

    // Create datapoints for each measurement
    const createdDatapoints = [];
    for (const point of dataPoints) {
      try {
        // Get the field definition from device
        const fieldDef = (device.dataPoints ?? []).find(
          (f) => f.pointName === point.name,
        );

        if (!fieldDef) {
          console.warn(`Field ${point.name} not found in device definition`);
          continue;
        }

        // Create datapoint record using Datapoints schema fields
        const datapoint = await payload.create({
          collection: "datapoints",
          data: {
            organisation: orgId,
            period: resolvedPeriodId,
            metricKey: `iot.${device.deviceId}.${point.name}`,
            value: point.value,
            unit: fieldDef.unit,
            quality: "measured",
            source: "api",
            approvalState: "pending",
            factorId: timestamp
              ? `iot:${device.id}:${timestamp}`
              : `iot:${device.id}:${new Date().toISOString()}`,
          },
        });

        createdDatapoints.push(datapoint);

        // Check for anomalies if enabled
        if (device.anomalyDetectionEnabled) {
          await checkAnomalies(orgId, device.id, point, fieldDef);
        }
      } catch (error) {
        console.error(`Error creating datapoint for ${point.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      deviceId,
      datapointsCreated: createdDatapoints.length,
      deviceStatus: "connected",
    });
  } catch (error) {
    console.error("Error ingesting IoT data:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function checkAnomalies(
  orgId: string,
  deviceId: string,
  point: IngestPoint,
  fieldDef: DeviceDataPoint,
): Promise<void> {
  const payload = await getPayload({ config });

  // Get recent readings for this field
  const recentReadings = await payload.find({
    collection: "datapoints",
    where: {
      organisation: { equals: orgId },
      unit: { equals: fieldDef.unit },
      createdAt: {
        greater_than_equal: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    sort: "-createdAt",
    limit: 100,
  });

  if (recentReadings.totalDocs < 5) return; // Not enough data for anomaly detection

  // Calculate mean and std dev
  const values = recentReadings.docs.map((d) => d.value ?? 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Check if current value is outside threshold (±20% by default)
  const threshold = mean === 0 ? 0 : (stdDev / mean) * 100;
  const device = await payload.findByID({
    collection: "iot-devices",
    id: deviceId,
  });

  const anomalyThreshold = device.anomalyThreshold ?? 20;

  if (threshold > anomalyThreshold) {
    // Create alert via audit-logs schema
    await payload.create({
      collection: "audit-logs",
      data: {
        organisation: orgId,
        action: "anomaly_detected",
        entityType: "iot-device",
        entityId: deviceId,
        after: {
          fieldName: point.name,
          value: point.value,
          expectedRange: `${mean - stdDev} to ${mean + stdDev}`,
          variancePercent: threshold,
        },
      },
    });
  }
}

/**
 * GET /api/app/iot/devices
 * List IoT devices for organization
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });

    // Get deviceId from query
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId");

    if (deviceId) {
      const devices = await payload.find({
        collection: "iot-devices",
        where: { deviceId: { equals: deviceId } },
        limit: 1,
      });

      if (!devices.docs?.[0]) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }

      return NextResponse.json(devices.docs[0]);
    }

    // Return list of all devices (for debugging)
    const devices = await payload.find({
      collection: "iot-devices",
      limit: 100,
    });

    return NextResponse.json({
      total: devices.totalDocs,
      devices: devices.docs,
    });
  } catch (error) {
    console.error("Error fetching IoT devices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
