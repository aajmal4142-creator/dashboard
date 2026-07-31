/**
 * SSE helpers for the dashboard realtime stream.
 *
 * Why SSE instead of WebSocket:
 * - This app deploys on Vercel (see vercel.json crons). Native WebSocket
 *   upgrades are not available on Vercel serverless functions.
 * - SSE works over a normal authenticated HTTP GET with cookies, reconnects
 *   cleanly, and matches the subscribe/emit contract in `types.ts`.
 *
 * Multi-instance note: the in-process hub only fans out within one Node
 * process. Clients fall back to REST polling when the stream is unavailable.
 */

import type { DashboardStreamMessage } from "./types";

export function encodeSse(message: DashboardStreamMessage, eventId?: string): string {
  const lines: string[] = [];
  if (eventId) {
    lines.push(`id: ${eventId}`);
  }
  lines.push(`event: ${message.type}`);
  lines.push(`data: ${JSON.stringify(message)}`);
  lines.push("", "");
  return lines.join("\n");
}

export function sseResponseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable buffering on common reverse proxies
    "X-Accel-Buffering": "no",
  };
}

export const HEARTBEAT_INTERVAL_MS = 15_000;
