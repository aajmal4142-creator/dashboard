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
 * PUT /api/app/iot/devices/[id]
 * Update facility link and/or free-text location (facility preferred when set).
 */
export async function PUT(request: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageDevices(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can update IoT devices" },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      facilityId?: string | null;
      location?: string | null;
    };

    const payload = await getPayload({ config });
    const device = await payload.findByID({
      collection: "iot-devices",
      id,
      overrideAccess: true,
    });

    if (!device || orgIdOf(device.organisation) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.facilityId !== undefined) {
      if (body.facilityId === null || body.facilityId === "") {
        data.facility = null;
      } else {
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
          data.facility = body.facilityId;
        } catch {
          return NextResponse.json(
            { error: "facilityId not found in this organisation" },
            { status: 400 },
          );
        }
      }
    }

    if (body.location !== undefined) {
      data.location =
        body.location === null || body.location === ""
          ? null
          : String(body.location).trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Provide facilityId and/or location" },
        { status: 400 },
      );
    }

    const updated = await payload.update({
      collection: "iot-devices",
      id,
      data,
      overrideAccess: true,
    });

    const facilityId =
      updated.facility == null
        ? null
        : typeof updated.facility === "string"
          ? updated.facility
          : (updated.facility as { id: string }).id;

    return NextResponse.json({
      device: {
        id: updated.id,
        facilityId,
        location: updated.location ?? null,
      },
    });
  } catch (error) {
    console.error("IoT device update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
