import type { Payload } from "payload";

import { publishBus } from "./bus";
import {
  computeOrgKpiSnapshot,
  snapshotToUpdates,
  type OrgKpiSnapshot,
} from "./broadcast";
import type { DashboardUpdate } from "./types";

/**
 * Recalculate org KPIs and broadcast to SSE subscribers on every instance (via the
 * realtime bus — Redis relay when configured, local hub otherwise).
 * Fire-and-forget from collection hooks / API routes — never block writes.
 */
export async function broadcastOrgDashboard(
  payload: Payload,
  organisationId: string,
  activity?: DashboardUpdate["activity"],
): Promise<OrgKpiSnapshot> {
  const snapshot = await computeOrgKpiSnapshot(payload, organisationId);
  for (const update of snapshotToUpdates(snapshot, activity)) {
    await publishBus(organisationId, update);
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
