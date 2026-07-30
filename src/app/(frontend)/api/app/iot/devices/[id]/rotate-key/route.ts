import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { generateDeviceApiKey } from "@/lib/iot";
import { writeAuditLog } from "@/lib/audit/write";
import config from "@/payload.config";

function canManageDevices(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function orgIdOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/app/iot/devices/[id]/rotate-key — issue a new device API key.
 */
export async function POST(_request: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageDevices(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can rotate device API keys" },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  try {
    const payload = await getPayload({ config });
    const device = await payload.findByID({
      collection: "iot-devices",
      id,
      overrideAccess: true,
    });

    if (!device || orgIdOf(device.organisation) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const { apiKey, apiKeyHash, apiKeyPrefix } = generateDeviceApiKey();

    await payload.update({
      collection: "iot-devices",
      id,
      data: { apiKeyHash, apiKeyPrefix },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "iot.device_key_rotated",
      entityType: "iot-devices",
      entityId: id,
      after: { apiKeyPrefix },
    });

    return NextResponse.json({
      apiKey,
      apiKeyPrefix,
      note: "Store this API key now. The previous key is invalidated.",
    });
  } catch (error) {
    console.error("IoT key rotate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
