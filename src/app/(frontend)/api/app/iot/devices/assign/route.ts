import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { parseDeviceGatewayCsv } from "@/lib/iot";
import config from "@/payload.config";

import {
  badRequest,
  canManageGateways,
  forbidden,
  orgIdOf,
} from "../../gateways/_shared";

/**
 * POST /api/app/iot/devices/assign
 * Body: { deviceId, gatewayId } | { assignments: [...] } | { csv: "device_id,gateway_id\n..." }
 * deviceId accepts Payload doc id OR external deviceId string.
 * gatewayId null/empty unassigns.
 */
export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) return forbidden();
  if (!canManageGateways(ctx.role)) {
    return forbidden("Only owners and admins can assign devices to gateways");
  }

  let body: {
    deviceId?: string;
    gatewayId?: string | null;
    assignments?: Array<{ deviceId: string; gatewayId: string | null }>;
    csv?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const rows: Array<{ deviceId: string; gatewayId: string | null }> = [];
  if (typeof body.csv === "string" && body.csv.trim()) {
    for (const row of parseDeviceGatewayCsv(body.csv)) {
      rows.push({ deviceId: row.deviceId, gatewayId: row.gatewayId });
    }
  } else if (Array.isArray(body.assignments)) {
    for (const a of body.assignments) {
      if (!a?.deviceId) continue;
      rows.push({
        deviceId: String(a.deviceId),
        gatewayId: a.gatewayId == null || a.gatewayId === "" ? null : String(a.gatewayId),
      });
    }
  } else if (body.deviceId) {
    rows.push({
      deviceId: body.deviceId,
      gatewayId: body.gatewayId == null || body.gatewayId === "" ? null : body.gatewayId,
    });
  } else {
    return badRequest(
      "Provide deviceId+gatewayId, assignments[], or csv (device_id,gateway_id)",
    );
  }

  if (rows.length === 0) return badRequest("No assignment rows to process");

  const payload = await getPayload({ config });
  const gatewayCache = new Map<string, boolean>();

  async function gatewayOwned(gatewayId: string): Promise<boolean> {
    if (gatewayCache.has(gatewayId)) return gatewayCache.get(gatewayId)!;
    try {
      const gw = await payload.findByID({
        collection: "iot-gateways",
        id: gatewayId,
        depth: 0,
        overrideAccess: true,
      });
      const ok =
        Boolean(gw) &&
        orgIdOf(gw.organisation as string | { id: string }) === ctx.activeOrg!.id;
      gatewayCache.set(gatewayId, ok);
      return ok;
    } catch {
      gatewayCache.set(gatewayId, false);
      return false;
    }
  }

  async function findDevice(deviceKey: string) {
    try {
      const byId = await payload.findByID({
        collection: "iot-devices",
        id: deviceKey,
        depth: 0,
        overrideAccess: true,
      });
      if (
        byId &&
        orgIdOf(byId.organisation as string | { id: string }) === ctx.activeOrg!.id
      ) {
        return byId;
      }
    } catch {
      // fall through to external deviceId lookup
    }
    const found = await payload.find({
      collection: "iot-devices",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg!.id } },
          { deviceId: { equals: deviceKey } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    return found.docs[0] ?? null;
  }

  const results: Array<{
    deviceId: string;
    gatewayId: string | null;
    ok: boolean;
    error?: string;
    docId?: string;
  }> = [];

  for (const row of rows) {
    const device = await findDevice(row.deviceId);
    if (!device) {
      results.push({
        deviceId: row.deviceId,
        gatewayId: row.gatewayId,
        ok: false,
        error: "Device not found in this organisation",
      });
      continue;
    }
    if (row.gatewayId) {
      const ok = await gatewayOwned(row.gatewayId);
      if (!ok) {
        results.push({
          deviceId: row.deviceId,
          gatewayId: row.gatewayId,
          ok: false,
          error: "Gateway not found in this organisation",
        });
        continue;
      }
    }

    await payload.update({
      collection: "iot-devices",
      id: device.id,
      data: { gateway: row.gatewayId },
      overrideAccess: true,
    });

    results.push({
      deviceId: row.deviceId,
      gatewayId: row.gatewayId,
      ok: true,
      docId: device.id,
    });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "iot.devices_gateway_assigned",
    entityType: "iot-devices",
    entityId: ctx.activeOrg.id,
    after: { succeeded, failed, total: results.length },
  });

  return NextResponse.json({
    results,
    succeeded,
    failed,
    total: results.length,
  });
}
