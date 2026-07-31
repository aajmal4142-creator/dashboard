import { NextResponse } from "next/server";

import {
  resolveFailoverGateway,
  resolveGatewayHealth,
  type GatewayHealthBadge,
} from "@/lib/iot";

export type GatewayDoc = {
  id: string;
  name: string;
  gatewayType: string;
  cloudProvider?: string | null;
  endpoint?: string | null;
  encryptedCredentials?: string | null;
  status?: string | null;
  lastHeartbeat?: string | null;
  lastDataReceived?: string | null;
  lastSyncAt?: string | null;
  offlineAlertSentAt?: string | null;
  failoverNote?: string | null;
  preferredFailoverGateway?: string | { id: string } | null;
  syncIndependent?: boolean | null;
  createdAt: string;
  updatedAt: string;
  organisation: string | { id: string };
};

export function orgIdOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

export function canManageGateways(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

export function preferredIdOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export const GATEWAY_TYPES = new Set(["mqtt", "http", "webhook", "direct", "cloud"]);

export const CLOUD_PROVIDERS = new Set(["aws_iot", "azure_iot", "gcp_iot"]);

export function publicGateway(
  doc: GatewayDoc,
  opts?: {
    deviceCount?: number;
    peers?: GatewayDoc[];
  },
) {
  const health = resolveGatewayHealth({
    storedStatus: doc.status,
    lastHeartbeat: doc.lastHeartbeat,
    lastDataReceived: doc.lastDataReceived,
  });

  const peers = (opts?.peers ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    gatewayType: p.gatewayType,
    status: resolveGatewayHealth({
      storedStatus: p.status,
      lastHeartbeat: p.lastHeartbeat,
      lastDataReceived: p.lastDataReceived,
    }).badge,
    preferredFailoverGatewayId: preferredIdOf(p.preferredFailoverGateway),
  }));

  const failover = resolveFailoverGateway({
    primary: {
      id: doc.id,
      name: doc.name,
      gatewayType: doc.gatewayType,
      status: health.badge,
      preferredFailoverGatewayId: preferredIdOf(doc.preferredFailoverGateway),
    },
    peers,
    nowHealth: health.badge,
  });

  return {
    id: doc.id,
    name: doc.name,
    gatewayType: doc.gatewayType,
    cloudProvider: doc.cloudProvider ?? null,
    endpoint: doc.endpoint ?? null,
    hasCredentials: Boolean(doc.encryptedCredentials),
    status: health.badge as GatewayHealthBadge,
    storedStatus: doc.status ?? "offline",
    lastHeartbeat: doc.lastHeartbeat ?? null,
    lastDataReceived: doc.lastDataReceived ?? null,
    lastSyncAt: doc.lastSyncAt ?? null,
    failoverNote: doc.failoverNote ?? null,
    preferredFailoverGatewayId: preferredIdOf(doc.preferredFailoverGateway),
    syncIndependent: doc.syncIndependent !== false,
    deviceCount: opts?.deviceCount ?? 0,
    health: {
      badge: health.badge,
      message: health.message,
      offlineMs: health.offlineMs,
      shouldAlertOffline: health.shouldAlertOffline,
    },
    failover: failover
      ? {
          gatewayId: failover.id,
          gatewayName: failover.name,
          note:
            doc.failoverNote?.trim() ||
            `Primary offline — route same-type devices via ${failover.name}.`,
        }
      : health.badge === "offline"
        ? {
            gatewayId: null,
            gatewayName: null,
            note:
              doc.failoverNote?.trim() ||
              "Gateway offline and no same-type peer is online. Restore connectivity or register a failover hub.",
          }
        : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
