"use client";

/**
 * Client hook for dashboard live KPIs.
 * Prefers SSE at `/api/ws/dashboard`; falls back to REST polling after
 * repeated stream failures. Reconnect uses exponential backoff (`backoff.ts`).
 */

import { useEffect, useRef, useState } from "react";

import { nextAttempt, reconnectDelayMs, resetAttempt } from "@/lib/realtime/backoff";
import type {
  DashboardMetric,
  DashboardUpdate,
  PublicKpiPayload,
} from "@/lib/realtime/types";

export type RealtimeConnectionState = "connecting" | "live" | "polling" | "offline";

export type LiveKpiState = {
  emissions: number | null;
  scopes: { scope1: number; scope2: number; scope3: number } | null;
  datapointCount: number | null;
  pendingApproval: number | null;
  reportCount: number | null;
  lastActivity: DashboardUpdate["activity"] | null;
};

const POLL_INTERVAL_MS = 15_000;
const STREAM_FAIL_BEFORE_POLL = 3;

function applyUpdate(prev: LiveKpiState, update: DashboardUpdate): LiveKpiState {
  const next: LiveKpiState = {
    ...prev,
    lastActivity: update.activity ?? prev.lastActivity,
  };
  switch (update.metric) {
    case "emissions":
      next.emissions = update.value;
      if (update.scopes) next.scopes = update.scopes;
      break;
    case "datapoints":
      next.datapointCount = update.value;
      break;
    case "pending_approval":
      next.pendingApproval = update.value;
      break;
    case "reports":
      next.reportCount = update.value;
      break;
  }
  return next;
}

function fromPayload(payload: PublicKpiPayload): LiveKpiState {
  return {
    emissions: payload.emissions.total,
    scopes: {
      scope1: payload.emissions.scope1,
      scope2: payload.emissions.scope2,
      scope3: payload.emissions.scope3,
    },
    datapointCount: payload.datapoints.count,
    pendingApproval: payload.pendingApproval,
    reportCount: payload.reports.count,
    lastActivity: null,
  };
}

export function useDashboardRealtime(opts?: {
  metrics?: DashboardMetric[];
  enabled?: boolean;
}) {
  const enabled = opts?.enabled !== false;
  const metrics = opts?.metrics;
  const metricsKey = metrics?.join(",") ?? "*";

  const [connection, setConnection] = useState<RealtimeConnectionState>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [live, setLive] = useState<LiveKpiState>({
    emissions: null,
    scopes: null,
    datapointCount: null,
    pendingApproval: null,
    reportCount: null,
    lastActivity: null,
  });

  const attemptRef = useRef(0);
  const failCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let source: EventSource | null = null;

    const clearPoll = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const markUpdated = () => {
      setLastUpdatedAt(Date.now());
    };

    const pollOnce = async () => {
      try {
        const res = await fetch("/api/app/realtime/kpis", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`KPI poll ${res.status}`);
        const body = (await res.json()) as PublicKpiPayload & { ok?: boolean };
        if (cancelled) return;
        setLive(fromPayload(body));
        markUpdated();
        setConnection("polling");
      } catch {
        if (!cancelled) setConnection("offline");
      }
    };

    const startPolling = () => {
      clearPoll();
      setConnection("polling");
      void pollOnce();
      pollTimerRef.current = setInterval(() => {
        void pollOnce();
      }, POLL_INTERVAL_MS);
    };

    const connectStream = () => {
      if (cancelled) return;
      clearReconnect();
      setConnection("connecting");

      const url = new URL("/api/ws/dashboard", window.location.origin);
      url.searchParams.set("metrics", metricsKey);
      source = new EventSource(url.toString());

      source.addEventListener("hello", () => {
        if (cancelled) return;
        attemptRef.current = resetAttempt();
        failCountRef.current = 0;
        clearPoll();
        setConnection("live");
        markUpdated();
      });

      source.addEventListener("heartbeat", () => {
        if (cancelled) return;
        markUpdated();
      });

      source.addEventListener("update", (evt) => {
        if (cancelled) return;
        try {
          const data = JSON.parse((evt as MessageEvent).data) as DashboardUpdate & {
            type?: string;
          };
          setLive((prev) => applyUpdate(prev, data));
          markUpdated();
          setConnection("live");
        } catch {
          // ignore malformed
        }
      });

      source.onerror = () => {
        if (cancelled) return;
        source?.close();
        source = null;
        failCountRef.current += 1;
        attemptRef.current = nextAttempt(attemptRef.current);

        if (failCountRef.current >= STREAM_FAIL_BEFORE_POLL) {
          startPolling();
        }

        const delay = reconnectDelayMs(attemptRef.current - 1);
        reconnectTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          // Keep polling while retrying stream
          connectStream();
        }, delay);
      };
    };

    connectStream();

    return () => {
      cancelled = true;
      source?.close();
      clearPoll();
      clearReconnect();
    };
  }, [enabled, metricsKey]);

  return {
    connection,
    lastUpdatedAt,
    live,
    isLive: connection === "live",
    isPolling: connection === "polling",
  };
}
