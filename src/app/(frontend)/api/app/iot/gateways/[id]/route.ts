import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { encryptCredentials } from "@/lib/database/encrypt";
import config from "@/payload.config";

import {
  badRequest,
  canManageGateways,
  CLOUD_PROVIDERS,
  forbidden,
  GATEWAY_TYPES,
  orgIdOf,
  publicGateway,
  type GatewayDoc,
} from "../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadOwned(id: string, organisationId: string) {
  const payload = await getPayload({ config });
  const doc = (await payload.findByID({
    collection: "iot-gateways",
    id,
    depth: 0,
    overrideAccess: true,
  })) as GatewayDoc | null;
  if (!doc || orgIdOf(doc.organisation) !== organisationId) return null;
  return { payload, doc };
}

async function countDevices(organisationId: string, gatewayId: string) {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "iot-devices",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { gateway: { equals: gatewayId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return result.totalDocs;
}

/**
 * GET /api/app/iot/gateways/[id]
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) return forbidden();

  const { id } = await ctx.params;
  const owned = await loadOwned(id, auth.activeOrg.id);
  if (!owned) {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  const peers = await owned.payload.find({
    collection: "iot-gateways",
    where: { organisation: { equals: auth.activeOrg.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });

  const deviceCount = await countDevices(auth.activeOrg.id, id);
  return NextResponse.json({
    gateway: publicGateway(owned.doc, {
      deviceCount,
      peers: peers.docs as GatewayDoc[],
    }),
  });
}

/**
 * PUT /api/app/iot/gateways/[id] — update endpoint / credentials / failover.
 */
export async function PUT(request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) return forbidden();
  if (!canManageGateways(auth.role)) {
    return forbidden("Only owners and admins can update IoT gateways");
  }

  const { id } = await ctx.params;
  const owned = await loadOwned(id, auth.activeOrg.id);
  if (!owned) {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    gatewayType?: string;
    cloudProvider?: string | null;
    endpoint?: string | null;
    credentials?: Record<string, unknown> | string | null;
    failoverNote?: string | null;
    preferredFailoverGatewayId?: string | null;
    syncIndependent?: boolean;
    status?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.gatewayType === "string") {
    if (!GATEWAY_TYPES.has(body.gatewayType)) {
      return badRequest("Invalid gatewayType");
    }
    data.gatewayType = body.gatewayType;
  }
  if (body.cloudProvider !== undefined) {
    if (body.cloudProvider === null || body.cloudProvider === "") {
      data.cloudProvider = null;
    } else if (!CLOUD_PROVIDERS.has(body.cloudProvider)) {
      return badRequest("Invalid cloudProvider");
    } else {
      data.cloudProvider = body.cloudProvider;
    }
  }
  if (body.endpoint !== undefined) {
    data.endpoint =
      typeof body.endpoint === "string" ? body.endpoint.trim() || null : null;
  }
  if (body.failoverNote !== undefined) {
    data.failoverNote =
      typeof body.failoverNote === "string" ? body.failoverNote.trim() || null : null;
  }
  if (body.syncIndependent !== undefined) {
    data.syncIndependent = Boolean(body.syncIndependent);
  }
  if (body.preferredFailoverGatewayId !== undefined) {
    if (
      body.preferredFailoverGatewayId === null ||
      body.preferredFailoverGatewayId === ""
    ) {
      data.preferredFailoverGateway = null;
    } else {
      if (body.preferredFailoverGatewayId === id) {
        return badRequest("preferredFailoverGatewayId cannot be self");
      }
      const peer = await owned.payload.findByID({
        collection: "iot-gateways",
        id: body.preferredFailoverGatewayId,
        depth: 0,
        overrideAccess: true,
      });
      if (
        !peer ||
        orgIdOf(peer.organisation as string | { id: string }) !== auth.activeOrg.id
      ) {
        return badRequest("preferredFailoverGatewayId not found in this organisation");
      }
      data.preferredFailoverGateway = body.preferredFailoverGatewayId;
    }
  }
  if (body.credentials !== undefined && body.credentials !== null) {
    const plaintext =
      typeof body.credentials === "string"
        ? body.credentials
        : JSON.stringify(body.credentials);
    if (plaintext.trim()) {
      data.encryptedCredentials = encryptCredentials(plaintext);
    }
  }

  const updated = (await owned.payload.update({
    collection: "iot-gateways",
    id,
    data,
    overrideAccess: true,
  })) as GatewayDoc;

  await writeAuditLog(owned.payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "iot.gateway_updated",
    entityType: "iot-gateways",
    entityId: id,
    after: {
      fields: Object.keys(data).filter((k) => k !== "encryptedCredentials"),
      credentialsRotated: "encryptedCredentials" in data,
    },
  });

  const peers = await owned.payload.find({
    collection: "iot-gateways",
    where: { organisation: { equals: auth.activeOrg.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  const deviceCount = await countDevices(auth.activeOrg.id, id);

  return NextResponse.json({
    gateway: publicGateway(updated, {
      deviceCount,
      peers: peers.docs as GatewayDoc[],
    }),
  });
}

/**
 * DELETE /api/app/iot/gateways/[id]
 */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) return forbidden();
  if (!canManageGateways(auth.role)) {
    return forbidden("Only owners and admins can delete IoT gateways");
  }

  const { id } = await ctx.params;
  const owned = await loadOwned(id, auth.activeOrg.id);
  if (!owned) {
    return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
  }

  const assigned = await countDevices(auth.activeOrg.id, id);
  if (assigned > 0) {
    return NextResponse.json(
      {
        error: `Gateway still has ${assigned} assigned device(s). Reassign or unassign them first.`,
      },
      { status: 409 },
    );
  }

  await owned.payload.delete({
    collection: "iot-gateways",
    id,
    overrideAccess: true,
  });

  await writeAuditLog(owned.payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "iot.gateway_deleted",
    entityType: "iot-gateways",
    entityId: id,
    before: { name: owned.doc.name, gatewayType: owned.doc.gatewayType },
  });

  return NextResponse.json({ success: true, id });
}
