import type { IotDevicePublicStatus } from "./types";

export const DEFAULT_OFFLINE_AFTER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Derive online/offline from lastHeartbeat.
 * Stored statuses "connected"/"disconnected" are normalized to public online/offline.
 */
export function resolveDeviceStatus(input: {
  storedStatus?: string | null;
  lastHeartbeat?: string | null;
  offlineAfterMs?: number | null;
  now?: Date;
}): IotDevicePublicStatus {
  const stored = input.storedStatus ?? null;
  if (stored === "error" || stored === "maintenance") {
    return stored;
  }

  const offlineAfter = input.offlineAfterMs ?? DEFAULT_OFFLINE_AFTER_MS;
  const now = input.now ?? new Date();

  if (!input.lastHeartbeat) {
    return "offline";
  }

  const hb = new Date(input.lastHeartbeat).getTime();
  if (Number.isNaN(hb)) return "offline";

  if (now.getTime() - hb > offlineAfter) {
    return "offline";
  }

  return "online";
}

export function toStoredStatus(
  publicStatus: IotDevicePublicStatus,
): "online" | "offline" | "error" | "maintenance" | "connected" | "disconnected" {
  if (publicStatus === "online") return "online";
  if (publicStatus === "offline") return "offline";
  return publicStatus;
}
