/**
 * In-process pub/sub hub for dashboard KPI updates.
 *
 * Limitation: subscribers only see events published directly to `publish()` in the
 * same Node process. Multi-instance / serverless fan-out needs `./bus.ts`
 * (`publishBus` / `ensureBusSubscriber`), which relays through Upstash Redis when
 * configured and always falls back to this local-only hub otherwise. REST polling
 * (`/api/app/realtime/kpis`) remains the cross-instance fallback when no bus is
 * configured at all.
 */

import type { DashboardMetric, DashboardUpdate } from "./types";

export type HubSubscriber = {
  id: string;
  organisationId: string;
  metrics: Set<DashboardMetric>;
  send: (update: DashboardUpdate) => void;
};

type HubState = {
  subscribers: Map<string, HubSubscriber>;
  /** Last value per org+metric for changePercent */
  lastValues: Map<string, number>;
  nextId: number;
};

const GLOBAL_KEY = "__clearesg_dashboard_realtime_hub__";

function getState(): HubState {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: HubState;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      subscribers: new Map(),
      lastValues: new Map(),
      nextId: 1,
    };
  }
  return g[GLOBAL_KEY];
}

function lastKey(organisationId: string, metric: DashboardMetric): string {
  return `${organisationId}:${metric}`;
}

export function subscribe(opts: {
  organisationId: string;
  metrics: DashboardMetric[];
  send: (update: DashboardUpdate) => void;
}): { id: string; unsubscribe: () => void } {
  const state = getState();
  const id = `sub_${state.nextId++}`;
  const subscriber: HubSubscriber = {
    id,
    organisationId: opts.organisationId,
    metrics: new Set(opts.metrics),
    send: opts.send,
  };
  state.subscribers.set(id, subscriber);
  return {
    id,
    unsubscribe: () => {
      state.subscribers.delete(id);
    },
  };
}

/**
 * Publish an update to subscribers of the same organisation only.
 * Attaches changePercent from the previous published value for that org+metric.
 */
export function publish(
  organisationId: string,
  update: Omit<DashboardUpdate, "changePercent"> & {
    changePercent?: number | null;
  },
): DashboardUpdate {
  const state = getState();
  const key = lastKey(organisationId, update.metric);
  const prev = state.lastValues.get(key);
  const changePercent =
    update.changePercent !== undefined
      ? update.changePercent
      : prev != null && prev !== 0
        ? ((update.value - prev) / Math.abs(prev)) * 100
        : prev != null && prev === 0 && update.value !== 0
          ? 100
          : null;

  const full: DashboardUpdate = {
    ...update,
    changePercent,
  };

  state.lastValues.set(key, update.value);

  for (const sub of state.subscribers.values()) {
    if (sub.organisationId !== organisationId) continue;
    if (!sub.metrics.has(update.metric)) continue;
    try {
      sub.send(full);
    } catch {
      // Drop broken subscriber; client reconnect will re-subscribe.
      state.subscribers.delete(sub.id);
    }
  }

  return full;
}

/** Test / diagnostics helpers */
export function subscriberCount(organisationId?: string): number {
  const state = getState();
  if (!organisationId) return state.subscribers.size;
  let n = 0;
  for (const sub of state.subscribers.values()) {
    if (sub.organisationId === organisationId) n += 1;
  }
  return n;
}

export function clearHubForTests(): void {
  const state = getState();
  state.subscribers.clear();
  state.lastValues.clear();
  state.nextId = 1;
}

export function getLastValue(
  organisationId: string,
  metric: DashboardMetric,
): number | undefined {
  return getState().lastValues.get(lastKey(organisationId, metric));
}
