/**
 * Pure gateway health + failover helpers (zero I/O).
 *
 * Heartbeat cadence: gateways should ping every ~5 minutes.
 * Offline alert: raised when no heartbeat for >30 minutes.
 * Stale: heartbeat recent but no data for >1 hour.
 */

export const GATEWAY_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
export const GATEWAY_OFFLINE_AFTER_MS = 10 * 60 * 1000; // 2 missed heartbeats
export const GATEWAY_OFFLINE_ALERT_AFTER_MS = 30 * 60 * 1000;
export const GATEWAY_STALE_DATA_AFTER_MS = 60 * 60 * 1000;

export type GatewayHealthBadge = "online" | "offline" | "stale" | "error";

export type GatewayHealthInput = {
  storedStatus?: string | null;
  lastHeartbeat?: string | null;
  lastDataReceived?: string | null;
  offlineAfterMs?: number | null;
  staleDataAfterMs?: number | null;
  now?: Date;
};

export type GatewayHealthResult = {
  badge: GatewayHealthBadge;
  offlineMs: number | null;
  shouldAlertOffline: boolean;
  message: string;
};

function parseTs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Derive online / offline / stale badge from heartbeat + last data.
 * Stored "error" is preserved. Offline is never silent — message always set.
 */
export function resolveGatewayHealth(input: GatewayHealthInput): GatewayHealthResult {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const offlineAfter = input.offlineAfterMs ?? GATEWAY_OFFLINE_AFTER_MS;
  const staleAfter = input.staleDataAfterMs ?? GATEWAY_STALE_DATA_AFTER_MS;

  if (input.storedStatus === "error") {
    return {
      badge: "error",
      offlineMs: null,
      shouldAlertOffline: false,
      message: "Gateway reported an error. Check endpoint credentials and reconnect.",
    };
  }

  const hb = parseTs(input.lastHeartbeat);
  if (hb == null) {
    return {
      badge: "offline",
      offlineMs: null,
      shouldAlertOffline: true,
      message:
        "No heartbeat received. Gateway is offline — assign devices to a peer or restore connectivity.",
    };
  }

  const offlineMs = Math.max(0, nowMs - hb);
  if (offlineMs > offlineAfter) {
    const shouldAlertOffline = offlineMs > GATEWAY_OFFLINE_ALERT_AFTER_MS;
    return {
      badge: "offline",
      offlineMs,
      shouldAlertOffline,
      message: shouldAlertOffline
        ? `Gateway offline for more than 30 minutes (${Math.round(offlineMs / 60000)} min). Failover to a peer gateway if available.`
        : `Gateway offline (${Math.round(offlineMs / 60000)} min since last heartbeat).`,
    };
  }

  const lastData = parseTs(input.lastDataReceived);
  if (lastData != null && nowMs - lastData > staleAfter) {
    return {
      badge: "stale",
      offlineMs: 0,
      shouldAlertOffline: false,
      message: `Heartbeat OK but no data for more than 1 hour (${Math.round((nowMs - lastData) / 60000)} min).`,
    };
  }

  if (lastData == null) {
    return {
      badge: "online",
      offlineMs: 0,
      shouldAlertOffline: false,
      message: "Gateway online. Awaiting first data from assigned devices.",
    };
  }

  return {
    badge: "online",
    offlineMs: 0,
    shouldAlertOffline: false,
    message: "Gateway online and receiving data.",
  };
}

export type FailoverGatewayCandidate = {
  id: string;
  name: string;
  gatewayType: string;
  status: GatewayHealthBadge | string;
  preferredFailoverGatewayId?: string | null;
};

/**
 * When primary is offline, pick a peer of the same gatewayType that is online.
 * Prefers explicit preferredFailoverGateway when that peer is online.
 * Returns null when no peer is available (caller must surface the alert).
 */
export function resolveFailoverGateway(input: {
  primary: FailoverGatewayCandidate;
  peers: FailoverGatewayCandidate[];
  nowHealth?: GatewayHealthBadge;
}): FailoverGatewayCandidate | null {
  const primaryBadge = input.nowHealth ?? String(input.primary.status);
  if (primaryBadge === "online" || primaryBadge === "stale") {
    return null;
  }

  const sameTypeOnline = input.peers.filter(
    (p) =>
      p.id !== input.primary.id &&
      p.gatewayType === input.primary.gatewayType &&
      (p.status === "online" || p.status === "stale"),
  );

  if (sameTypeOnline.length === 0) return null;

  const preferredId = input.primary.preferredFailoverGatewayId;
  if (preferredId) {
    const preferred = sameTypeOnline.find((p) => p.id === preferredId);
    if (preferred) return preferred;
  }

  return sameTypeOnline[0] ?? null;
}

/**
 * Parse bulk CSV lines: device_id,gateway_id (header optional).
 */
export function parseDeviceGatewayCsv(csv: string): Array<{
  deviceId: string;
  gatewayId: string;
}> {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const rows: Array<{ deviceId: string; gatewayId: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();
    if (
      i === 0 &&
      (lower.startsWith("device_id") ||
        lower.startsWith("deviceid") ||
        lower.includes("gateway_id"))
    ) {
      continue;
    }
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;
    rows.push({ deviceId: parts[0], gatewayId: parts[1] });
  }
  return rows;
}
