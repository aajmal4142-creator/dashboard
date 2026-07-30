import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
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
 * DELETE /api/app/iot/devices/[id]
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageDevices(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can delete IoT devices" },
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

    await payload.delete({
      collection: "iot-devices",
      id,
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "iot.device_deleted",
      entityType: "iot-devices",
      entityId: id,
      before: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
      },
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("IoT device delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
