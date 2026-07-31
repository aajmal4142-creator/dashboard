/**
 * Server-safe realtime exports.
 * Client code must import from `@/lib/realtime/types`, `backoff`, or
 * `useDashboardRealtime` — not this barrel — to avoid pulling Payload into the
 * client bundle.
 */
export * from "./websocket";
