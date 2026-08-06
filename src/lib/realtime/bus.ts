/**
 * Cross-instance realtime bus for dashboard KPI updates.
 *
 * `hub.ts` only fans out within one Node process. On multi-instance / serverless
 * deployments, an SSE connection on instance B never sees a `publish()` call made on
 * instance A. This module adds an optional Upstash Redis-backed relay on top of the
 * local hub:
 *
 * - `publishBus()` always publishes to the local hub first (same-instance delivery is
 *   instant), then — when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set —
 *   RPUSHes the update onto a capped, TTL'd list `clearesg:rt:queue:{orgId}`.
 * - `ensureBusSubscriber()` starts (at most once per org per process) a poll loop that
 *   LRANGE + LTRIMs that list every ~1.5s and re-publishes any new items into the local
 *   hub, so SSE connections on *this* instance receive updates that originated on other
 *   instances.
 *
 * Without Upstash configured, this degrades to the local hub only (documented in
 * `hub.ts`) — no cross-instance fan-out, but nothing breaks.
 */

import { Redis } from "@upstash/redis";

import { publish as publishLocal } from "./hub";
import { isDashboardMetric, type DashboardUpdate } from "./types";

const QUEUE_MAX_LEN = 100;
const QUEUE_TTL_SEC = 120;
const POLL_INTERVAL_MS = 1500;

function getUpstash(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Whether the cross-instance Redis relay is configured (vs. local-hub-only fallback). */
export function hasRealtimeBus(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function queueKey(organisationId: string): string {
  return `clearesg:rt:queue:${organisationId}`;
}

function isDashboardUpdateLike(value: unknown): value is DashboardUpdate {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.metric === "string" &&
    isDashboardMetric(v.metric) &&
    typeof v.value === "number" &&
    typeof v.timestamp === "string" &&
    (v.changePercent === null || typeof v.changePercent === "number")
  );
}

function parseQueueItem(raw: unknown): DashboardUpdate | null {
  const candidate = typeof raw === "string" ? safeJsonParse(raw) : raw;
  return isDashboardUpdateLike(candidate) ? candidate : null;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Publish an update to this org's subscribers on every instance.
 * Always publishes locally first; relays via Redis when configured.
 */
export async function publishBus(
  organisationId: string,
  update: Omit<DashboardUpdate, "changePercent"> & {
    changePercent?: number | null;
  },
): Promise<DashboardUpdate> {
  const full = publishLocal(organisationId, update);

  const redis = getUpstash();
  if (redis) {
    const key = queueKey(organisationId);
    try {
      await redis.rpush(key, JSON.stringify(full));
      await redis.ltrim(key, -QUEUE_MAX_LEN, -1);
      await redis.expire(key, QUEUE_TTL_SEC);
    } catch (err) {
      console.error("[realtime] bus relay publish failed; local hub only", err);
    }
  }

  return full;
}

type PollerState = { timer: ReturnType<typeof setInterval>; refCount: number };

const POLLERS_KEY = "__clearesg_realtime_bus_pollers__";

function getPollers(): Map<string, PollerState> {
  const g = globalThis as typeof globalThis & {
    [POLLERS_KEY]?: Map<string, PollerState>;
  };
  if (!g[POLLERS_KEY]) g[POLLERS_KEY] = new Map();
  return g[POLLERS_KEY];
}

async function pollOnce(organisationId: string, redis: Redis): Promise<void> {
  const key = queueKey(organisationId);
  const items = await redis.lrange(key, 0, -1);
  if (!items || items.length === 0) return;
  // Best-effort trim of what we just read; a concurrent RPUSH landing in this window
  // can race here — acceptable for a live KPI feed (missed items self-heal on the next
  // broadcast, and REST polling remains the authoritative fallback).
  await redis.ltrim(key, items.length, -1).catch(() => undefined);
  for (const raw of items) {
    const update = parseQueueItem(raw);
    if (update) publishLocal(organisationId, update);
  }
}

/**
 * Ensure this process is polling the Redis relay queue for `organisationId` while at
 * least one local SSE connection is interested. No-op (returns an inert release) when
 * Upstash isn't configured, or once already polling for this org in this process.
 */
export function ensureBusSubscriber(organisationId: string): { release: () => void } {
  const redis = getUpstash();
  if (!redis) {
    return { release: () => undefined };
  }

  const pollers = getPollers();
  let state = pollers.get(organisationId);
  if (!state) {
    const timer = setInterval(() => {
      void pollOnce(organisationId, redis).catch((err) => {
        console.error("[realtime] bus poll failed", err);
      });
    }, POLL_INTERVAL_MS);
    state = { timer, refCount: 0 };
    pollers.set(organisationId, state);
  }
  state.refCount += 1;

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      const current = pollers.get(organisationId);
      if (!current) return;
      current.refCount -= 1;
      if (current.refCount <= 0) {
        clearInterval(current.timer);
        pollers.delete(organisationId);
      }
    },
  };
}
