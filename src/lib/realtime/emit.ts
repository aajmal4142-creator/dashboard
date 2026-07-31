import type { Payload } from "payload";

import { publish } from "./hub";
import {
  computeOrgKpiSnapshot,
  snapshotToUpdates,
  type OrgKpiSnapshot,
} from "./broadcast";
import type { DashboardUpdate } from "./types";

/**
 * Recalculate org KPIs and broadcast to in-process SSE subscribers.
 * Fire-and-forget from collection hooks / API routes — never block writes.
 */
export async function broadcastOrgDashboard(
  payload: Payload,
  organisationId: string,
  activity?: DashboardUpdate["activity"],
): Promise<OrgKpiSnapshot> {
  const snapshot = await computeOrgKpiSnapshot(payload, organisationId);
  for (const update of snapshotToUpdates(snapshot, activity)) {
    publish(organisationId, update);
  }
  return snapshot;
}

/** Schedule a broadcast without awaiting (safe for hooks). */
export function scheduleOrgDashboardBroadcast(
  payload: Payload,
  organisationId: string,
  activity?: DashboardUpdate["activity"],
): void {
  void broadcastOrgDashboard(payload, organisationId, activity).catch((err) => {
    console.error("[realtime] dashboard broadcast failed", err);
  });
}
