import { NextResponse } from "next/server";
import { getHealthCheck } from "@/lib/monitoring/metrics";
import { stripeCircuitBreaker } from "@/lib/billing/circuitBreaker";

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers
 */
export async function GET() {
  try {
    const health = getHealthCheck();
    const stripeState = stripeCircuitBreaker.getState();

    const statusCode =
      health.status === "healthy" ? 200 : health.status === "degraded" ? 503 : 500;

    return NextResponse.json(
      {
        status: health.status,
        timestamp: health.timestamp,
        uptime: Math.round(health.uptime),
        metrics: health.metrics,
        services: {
          ...health.services,
          stripe:
            stripeState === "closed"
              ? "healthy"
              : stripeState === "half-open"
                ? "degraded"
                : "unavailable",
        },
      },
      { status: statusCode },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/health/live
 * Liveness probe - quick check if service is running
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
