/**
 * ClearESG dashboard realtime layer.
 *
 * Transport choice: Server-Sent Events (SSE), not native WebSockets.
 * Path `/api/ws/dashboard` is retained for the S6.6 contract; the upgrade
 * protocol is HTTP streaming (`text/event-stream`).
 *
 * This module re-exports the subscribe/emit surface expected by the sprint
 * prompt under a `websocket` name for discoverability.
 */

export {
  subscribe,
  publish,
  subscriberCount,
  clearHubForTests,
  getLastValue,
} from "./hub";
export {
  reconnectDelayMs,
  resetAttempt,
  nextAttempt,
  type BackoffOptions,
} from "./backoff";
export { encodeSse, sseResponseHeaders, HEARTBEAT_INTERVAL_MS } from "./sse";
export { ensureBusSubscriber, hasRealtimeBus, publishBus } from "./bus";
export {
  DASHBOARD_METRICS,
  isDashboardMetric,
  parseMetricsParam,
  type DashboardMetric,
  type DashboardUpdate,
  type DashboardStreamMessage,
  type PublicKpiPayload,
} from "./types";
export { broadcastOrgDashboard, scheduleOrgDashboardBroadcast } from "./emit";
export {
  computeOrgKpiSnapshot,
  snapshotToUpdates,
  toPublicKpiPayload,
  type OrgKpiSnapshot,
} from "./broadcast";
