/**
 * Public dashboard KPI stream contract.
 *
 * Transport: Server-Sent Events (SSE) at `/api/ws/dashboard`.
 * Native WebSockets are not used — Vercel serverless does not support
 * long-lived WS upgrades. See `sse.ts` / route comments.
 *
 * Only public KPI fields belong here. Never put notes, assignee identity,
 * evidence URLs, or peer org identities on this wire.
 */

export const DASHBOARD_METRICS = [
  "emissions",
  "datapoints",
  "reports",
  "pending_approval",
] as const;

export type DashboardMetric = (typeof DASHBOARD_METRICS)[number];

export type DashboardUpdate = {
  metric: DashboardMetric;
  /** Primary numeric value for the KPI card */
  value: number;
  /** Percent change vs last broadcast for this org+metric; null if no prior */
  changePercent: number | null;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Optional display unit (e.g. tCO₂e, count) */
  unit?: string;
  /** Public scope split when metric === "emissions" */
  scopes?: {
    scope1: number;
    scope2: number;
    scope2MarketBased?: number | null;
    scope3: number;
  };
  /** Recent activity tip (public fields only) */
  activity?: {
    kind: "datapoint" | "report";
    metricKey?: string;
    id?: string;
  };
};

export type DashboardSubscribeMessage = {
  type: "subscribe";
  organisationId: string;
  metrics: DashboardMetric[];
};

export type DashboardHelloMessage = {
  type: "hello";
  transport: "sse";
  organisationId: string;
  metrics: DashboardMetric[];
  timestamp: string;
};

export type DashboardHeartbeatMessage = {
  type: "heartbeat";
  timestamp: string;
};

export type DashboardStreamMessage =
  | DashboardHelloMessage
  | DashboardHeartbeatMessage
  | ({ type: "update" } & DashboardUpdate);

export function isDashboardMetric(value: string): value is DashboardMetric {
  return (DASHBOARD_METRICS as readonly string[]).includes(value);
}

export function parseMetricsParam(raw: string | null): DashboardMetric[] {
  if (!raw || raw.trim() === "" || raw.trim() === "*") {
    return [...DASHBOARD_METRICS];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: DashboardMetric[] = [];
  for (const part of parts) {
    if (isDashboardMetric(part) && !out.includes(part)) {
      out.push(part);
    }
  }
  return out.length > 0 ? out : [...DASHBOARD_METRICS];
}

/** REST / SSE public KPI snapshot (no sensitive fields). */
export type PublicKpiPayload = {
  organisationId: string;
  periodId: string | null;
  emissions: {
    total: number;
    scope1: number;
    scope2: number;
    scope2LocationBased?: number;
    scope2MarketBased?: number | null;
    scope2MarketQuality?: "measured" | "calculated" | "estimated" | "missing" | null;
    scope3: number;
    calcOk: boolean;
  };
  datapoints: {
    count: number;
    collected: number;
    required: number;
  };
  pendingApproval: number;
  reports: {
    count: number;
  };
  timestamp: string;
  metrics: DashboardMetric[];
};
