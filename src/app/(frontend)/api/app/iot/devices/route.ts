import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  DEFAULT_OFFLINE_AFTER_MS,
  generateDeviceApiKey,
  resolveDeviceStatus,
} from "@/lib/iot";
import { writeAuditLog } from "@/lib/audit/write";
import config from "@/payload.config";

type DeviceType =
  | "http"
  | "mqtt"
  | "modbus"
  | "opc_ua"
  | "utility_energy"
  | "utility_water"
  | "utility_gas"
  | "smart_meter";

const DEVICE_TYPES = new Set<string>([
  "http",
  "mqtt",
  "modbus",
  "opc_ua",
  "utility_energy",
  "utility_water",
  "utility_gas",
  "smart_meter",
]);

function canManageDevices(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function publicDevice(doc: {
  id: string;
  deviceName: string;
  deviceId: string;
  deviceType: string;
  status?: string | null;
  lastHeartbeat?: string | null;
  offlineAfterMinutes?: number | null;
  location?: string | null;
  apiKeyPrefix?: string | null;
  anomalyDetectionEnabled?: boolean | null;
  retentionDays?: number | null;
  sensorMappings?: unknown;
  gateway?: string | { id: string } | null;
  facility?: string | { id: string } | null;
  createdAt: string;
  updatedAt: string;
}) {
  const offlineAfterMs =
    typeof doc.offlineAfterMinutes === "number" && doc.offlineAfterMinutes > 0
      ? doc.offlineAfterMinutes * 60 * 1000
      : DEFAULT_OFFLINE_AFTER_MS;

  const status = resolveDeviceStatus({
    storedStatus: doc.status,
    lastHeartbeat: doc.lastHeartbeat,
    offlineAfterMs,
  });

  const gatewayId =
    doc.gateway == null
      ? null
      : typeof doc.gateway === "string"
        ? doc.gateway
        : doc.gateway.id;

  const facilityId =
    doc.facility == null
      ? null
      : typeof doc.facility === "string"
        ? doc.facility
        : doc.facility.id;

  return {
    id: doc.id,
    deviceName: doc.deviceName,
    deviceId: doc.deviceId,
    deviceType: doc.deviceType,
    gatewayId,
    facilityId,
    status,
    lastHeartbeat: doc.lastHeartbeat ?? null,
    location: doc.location ?? null,
    apiKeyPrefix: doc.apiKeyPrefix ?? null,
    anomalyDetectionEnabled: doc.anomalyDetectionEnabled !== false,
    retentionDays: doc.retentionDays ?? 365,
    sensorMappings: doc.sensorMappings ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/app/iot/devices — list devices for active org (membership-gated).
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "iot-devices",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-createdAt",
      limit: 200,
      overrideAccess: true,
    });

    const devices = result.docs.map((d) => publicDevice(d));
    const offline = devices.filter((d) => d.status === "offline");

    return NextResponse.json({
      devices,
      total: result.totalDocs,
      offlineCount: offline.length,
      offlineAlerts: offline.map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        deviceId: d.deviceId,
        lastHeartbeat: d.lastHeartbeat,
      })),
    });
  } catch (error) {
    console.error("IoT devices list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/iot/devices — register device; returns one-time API key.
 */
export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageDevices(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can register IoT devices" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      deviceName?: string;
      deviceId?: string;
      deviceType?: string;
      location?: string;
      gatewayId?: string;
      facilityId?: string | null;
      offlineAfterMinutes?: number;
      retentionDays?: number;
      sensorMappings?: Array<{
        sensorType: string;
        metricKey: string;
        unit?: string;
        scope?: string;
      }>;
    };

    if (!body.deviceName?.trim() || !body.deviceId?.trim()) {
      return NextResponse.json(
        { error: "deviceName and deviceId are required" },
        { status: 400 },
      );
    }

    const deviceType = (body.deviceType || "http") as DeviceType;
    if (!DEVICE_TYPES.has(deviceType)) {
      return NextResponse.json({ error: "Invalid deviceType" }, { status: 400 });
    }

    const { apiKey, apiKeyHash, apiKeyPrefix } = generateDeviceApiKey();
    const payload = await getPayload({ config });

    if (body.gatewayId) {
      try {
        const gw = await payload.findByID({
          collection: "iot-gateways",
          id: body.gatewayId,
          depth: 0,
          overrideAccess: true,
        });
        const gwOrg =
          typeof gw.organisation === "string" ? gw.organisation : gw.organisation?.id;
        if (!gw || gwOrg !== ctx.activeOrg.id) {
          return NextResponse.json(
            { error: "gatewayId not found in this organisation" },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: "gatewayId not found in this organisation" },
          { status: 400 },
        );
      }
    }

    let facilityId: string | undefined;
    if (body.facilityId) {
      try {
        const facility = await payload.findByID({
          collection: "facilities",
          id: body.facilityId,
          depth: 0,
          overrideAccess: true,
        });
        const facilityOrg =
          typeof facility.organisation === "string"
            ? facility.organisation
            : facility.organisation?.id;
        if (!facility || facilityOrg !== ctx.activeOrg.id) {
          return NextResponse.json(
            { error: "facilityId not found in this organisation" },
            { status: 400 },
          );
        }
        facilityId = body.facilityId;
      } catch {
        return NextResponse.json(
          { error: "facilityId not found in this organisation" },
          { status: 400 },
        );
      }
    }

    const created = await (
      payload.create as (args: {
        collection: "iot-devices";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<{
        id: string;
        deviceName: string;
        deviceId: string;
        deviceType: string;
        status?: string | null;
        lastHeartbeat?: string | null;
        offlineAfterMinutes?: number | null;
        location?: string | null;
        apiKeyPrefix?: string | null;
        anomalyDetectionEnabled?: boolean | null;
        retentionDays?: number | null;
        sensorMappings?: unknown;
        gateway?: string | { id: string } | null;
        facility?: string | { id: string } | null;
        createdAt: string;
        updatedAt: string;
      }>
    )({
      collection: "iot-devices",
      data: {
        organisation: ctx.activeOrg.id,
        deviceName: body.deviceName.trim(),
        deviceId: body.deviceId.trim(),
        deviceType,
        status: "offline",
        apiKeyHash,
        apiKeyPrefix,
        location: body.location?.trim() || undefined,
        gateway: body.gatewayId || undefined,
        facility: facilityId,
        offlineAfterMinutes: body.offlineAfterMinutes ?? 60,
        retentionDays: body.retentionDays ?? 365,
        anomalyDetectionEnabled: true,
        sensorMappings: body.sensorMappings ?? [],
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "iot.device_registered",
      entityType: "iot-devices",
      entityId: created.id,
      after: {
        deviceId: created.deviceId,
        deviceName: created.deviceName,
        apiKeyPrefix,
      },
    });

    return NextResponse.json(
      {
        device: publicDevice(created),
        apiKey,
        note: "Store this API key now. It cannot be retrieved again — only rotated.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("IoT device create error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
