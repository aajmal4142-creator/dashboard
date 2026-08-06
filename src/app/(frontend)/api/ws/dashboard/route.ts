/**
 * Dashboard realtime subscribe endpoint.
 *
 * Transport: Server-Sent Events (not WebSocket upgrade).
 * Path kept as `/api/ws/dashboard` for S6.6 contract compatibility.
 *
 * Auth: getApiContext() — Membership active org only.
 * Never accepts a client-supplied organisationId (prevents cross-org leaks).
 *
 * Limits: in-process hub; Vercel function maxDuration caps connection lifetime.
 * Client reconnects with exponential backoff; REST `/api/app/realtime/kpis` fallback.
 */

import { getApiContext } from "@/lib/auth";
import {
  HEARTBEAT_INTERVAL_MS,
  encodeSse,
  ensureBusSubscriber,
  parseMetricsParam,
  sseResponseHeaders,
  subscribe,
  type DashboardStreamMessage,
  type DashboardUpdate,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow long-lived SSE within platform limits; client reconnects on close. */
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const gate = await getApiContext();
  if (!gate.ok) {
    return gate.response;
  }
  const { ctx } = gate;
  if (!ctx.activeOrg || !ctx.role) {
    return Response.json(
      { error: "Authentication required. Sign in and select an organisation." },
      { status: 401 },
    );
  }

  const organisationId = ctx.activeOrg.id;
  const url = new URL(req.url);
  const metrics = parseMetricsParam(url.searchParams.get("metrics"));

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let eventSeq = 0;
  const busSubscriber = ensureBusSubscriber(organisationId);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (message: DashboardStreamMessage) => {
        if (closed) return;
        try {
          eventSeq += 1;
          controller.enqueue(encoder.encode(encodeSse(message, String(eventSeq))));
        } catch {
          cleanup();
        }
      };

      const sendUpdate = (update: DashboardUpdate) => {
        push({ type: "update", ...update });
      };

      const sub = subscribe({
        organisationId,
        metrics,
        send: sendUpdate,
      });
      unsubscribe = sub.unsubscribe;

      push({
        type: "hello",
        transport: "sse",
        organisationId,
        metrics,
        timestamp: new Date().toISOString(),
      });

      heartbeat = setInterval(() => {
        push({
          type: "heartbeat",
          timestamp: new Date().toISOString(),
        });
      }, HEARTBEAT_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      function cleanup() {
        if (closed) return;
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        unsubscribe?.();
        unsubscribe = null;
        busSubscriber.release();
      }
    },
    cancel() {
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      unsubscribe?.();
      unsubscribe = null;
      busSubscriber.release();
    },
  });

  return new Response(stream, {
    headers: sseResponseHeaders(),
  });
}
