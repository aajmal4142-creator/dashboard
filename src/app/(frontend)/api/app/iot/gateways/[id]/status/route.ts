import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { resolveGatewayHealth } from "@/lib/iot";
import config from "@/payload.config";

import {
  canManageGateways,
  forbidden,
  orgIdOf,
  publicGateway,
  type GatewayDoc,
} from "../../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/iot/gateways/[id]/status — health check + failover hint.
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) return forbidden();

  const { id } = await ctx.params;
  const payload = await getPayload({ config });

  let doc: GatewayDoc;
  try {
    doc = (await payload.findByID({
      collection: "iot-gateways",
      id,
      depth: 0,
      overrideAccess: true,
    })) as GatewayDoc;
  } catch {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  if (orgIdOf(doc.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  const peersResult = await payload.find({
    collection: "iot-gateways",
    where: { organisation: { equals: auth.activeOrg.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  const peers = peersResult.docs as GatewayDoc[];

  const devices = await payload.find({
    collection: "iot-devices",
    where: {
      and: [{ organisation: { equals: auth.activeOrg.id } }, { gateway: { equals: id } }],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  const health = resolveGatewayHealth({
    storedStatus: doc.status,
    lastHeartbeat: doc.lastHeartbeat,
    lastDataReceived: doc.lastDataReceived,
  });

  // Persist derived status so admin/lists stay consistent; never silent on offline.
  if (doc.status !== health.badge) {
    const updateData: Record<string, unknown> = { status: health.badge };
    if (health.shouldAlertOffline && !doc.offlineAlertSentAt) {
      updateData.offlineAlertSentAt = new Date().toISOString();
      await writeAuditLog(payload, {
        organisationId: auth.activeOrg.id,
        actorId: auth.user.id,
        action: "iot.gateway_offline_alert",
        entityType: "iot-gateways",
        entityId: id,
        after: { message: health.message },
      });
    }
    if (health.badge === "online" && doc.offlineAlertSentAt) {
      updateData.offlineAlertSentAt = null;
    }
    await payload.update({
      collection: "iot-gateways",
      id,
      data: updateData,
      overrideAccess: true,
    });
    doc = { ...doc, status: health.badge };
  }

  const gateway = publicGateway(doc, {
    deviceCount: devices.totalDocs,
    peers,
  });

  return NextResponse.json({
    gateway,
    devices: devices.docs.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      deviceId: d.deviceId,
      deviceType: d.deviceType,
      status: d.status,
      lastHeartbeat: d.lastHeartbeat ?? null,
    })),
    alert: gateway.health.shouldAlertOffline
      ? {
          severity: "high",
          message: gateway.health.message,
          failover: gateway.failover,
        }
      : null,
  });
}

/**
 * POST /api/app/iot/gateways/[id]/status — heartbeat ("I'm alive") from gateway.
 * Body optional: { lastDataReceived?: string }
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) return forbidden();
  if (!canManageGateways(auth.role)) {
    return forbidden("Only owners and admins can send gateway heartbeats");
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });

  let doc: GatewayDoc;
  try {
    doc = (await payload.findByID({
      collection: "iot-gateways",
      id,
      depth: 0,
      overrideAccess: true,
    })) as GatewayDoc;
  } catch {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  if (orgIdOf(doc.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  let body: { lastDataReceived?: string } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const data: Record<string, unknown> = {
    lastHeartbeat: nowIso,
    lastSyncAt: nowIso,
    status: "online",
    offlineAlertSentAt: null,
  };
  if (typeof body.lastDataReceived === "string" && body.lastDataReceived) {
    data.lastDataReceived = body.lastDataReceived;
  }

  const updated = (await payload.update({
    collection: "iot-gateways",
    id,
    data,
    overrideAccess: true,
  })) as GatewayDoc;

  return NextResponse.json({
    gateway: publicGateway(updated),
    note: "Heartbeat recorded. Expected cadence is every 5 minutes.",
  });
}
