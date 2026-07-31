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
} from "./_shared";

async function deviceCountsByGateway(
  organisationId: string,
): Promise<Map<string, number>> {
  const payload = await getPayload({ config });
  const devices = await payload.find({
    collection: "iot-devices",
    where: { organisation: { equals: organisationId } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });
  const counts = new Map<string, number>();
  for (const d of devices.docs) {
    const gw = d.gateway;
    if (!gw) continue;
    const gid = typeof gw === "string" ? gw : gw.id;
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }
  return counts;
}

/**
 * GET /api/app/iot/gateways — list gateways for active org with health + device counts.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) return forbidden();

  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "iot-gateways",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-createdAt",
      limit: 100,
      depth: 0,
      overrideAccess: true,
    });

    const docs = result.docs as GatewayDoc[];
    const counts = await deviceCountsByGateway(ctx.activeOrg.id);
    const gateways = docs.map((d) =>
      publicGateway(d, { deviceCount: counts.get(d.id) ?? 0, peers: docs }),
    );

    const alerts = gateways
      .filter((g) => g.health.shouldAlertOffline)
      .map((g) => ({
        id: g.id,
        name: g.name,
        message: g.health.message,
        failover: g.failover,
      }));

    return NextResponse.json({
      gateways,
      total: result.totalDocs,
      offlineAlerts: alerts,
    });
  } catch (error) {
    console.error("IoT gateways list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/iot/gateways — register gateway (credentials encrypted at rest).
 */
export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) return forbidden();
  if (!canManageGateways(ctx.role)) {
    return forbidden("Only owners and admins can register IoT gateways");
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      gatewayType?: string;
      cloudProvider?: string;
      endpoint?: string;
      credentials?: Record<string, unknown> | string;
      failoverNote?: string;
      preferredFailoverGatewayId?: string;
      syncIndependent?: boolean;
    };

    if (!body.name?.trim()) return badRequest("name is required");
    const gatewayTypeRaw = body.gatewayType || "http";
    if (!GATEWAY_TYPES.has(gatewayTypeRaw)) {
      return badRequest("Invalid gatewayType (mqtt|http|webhook|direct|cloud)");
    }
    const gatewayType = gatewayTypeRaw as
      "mqtt" | "http" | "webhook" | "direct" | "cloud";
    if (gatewayType === "cloud") {
      if (!body.cloudProvider || !CLOUD_PROVIDERS.has(body.cloudProvider)) {
        return badRequest(
          "cloudProvider is required for cloud gateways (aws_iot|azure_iot|gcp_iot). Free-tier stubs only.",
        );
      }
    }

    let encrypted: string | undefined;
    if (body.credentials != null) {
      const plaintext =
        typeof body.credentials === "string"
          ? body.credentials
          : JSON.stringify(body.credentials);
      if (plaintext.trim()) {
        encrypted = encryptCredentials(plaintext);
      }
    }

    const payload = await getPayload({ config });

    if (body.preferredFailoverGatewayId) {
      const peer = await payload.findByID({
        collection: "iot-gateways",
        id: body.preferredFailoverGatewayId,
        depth: 0,
        overrideAccess: true,
      });
      if (
        !peer ||
        orgIdOf(peer.organisation as string | { id: string }) !== ctx.activeOrg.id
      ) {
        return badRequest("preferredFailoverGatewayId not found in this organisation");
      }
    }

    const cloudProvider =
      gatewayType === "cloud"
        ? (body.cloudProvider as "aws_iot" | "azure_iot" | "gcp_iot")
        : undefined;

    const created = (await payload.create({
      collection: "iot-gateways",
      data: {
        organisation: ctx.activeOrg.id,
        name: body.name.trim(),
        gatewayType,
        cloudProvider,
        endpoint: body.endpoint?.trim() || undefined,
        encryptedCredentials: encrypted,
        status: "offline",
        failoverNote: body.failoverNote?.trim() || undefined,
        preferredFailoverGateway: body.preferredFailoverGatewayId || undefined,
        syncIndependent: body.syncIndependent !== false,
      },
      overrideAccess: true,
    })) as GatewayDoc;

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "iot.gateway_registered",
      entityType: "iot-gateways",
      entityId: created.id,
      after: {
        name: created.name,
        gatewayType: created.gatewayType,
        hasCredentials: Boolean(encrypted),
      },
    });

    return NextResponse.json(
      {
        gateway: publicGateway(created, { deviceCount: 0 }),
        note: encrypted
          ? "Credentials stored encrypted at rest and are never returned."
          : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("IoT gateway create error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
