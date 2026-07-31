import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { hasMinRole } from "@/lib/access/membership";
import {
  replayFailedDelivery,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";

/**
 * POST /api/app/webhooks/deliveries/[logId]/replay — re-send a dead-letter delivery
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId } = await params;
    const ctx = await getCurrentContext();

    if (!ctx.activeOrg || !ctx.role) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.UNAUTHORIZED, 403, "No active organisation"),
        ),
        { status: 403 },
      );
    }

    if (!hasMinRole(ctx.role, "admin")) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.UNAUTHORIZED, 403, "Admin access required"),
        ),
        { status: 403 },
      );
    }

    const result = await replayFailedDelivery({
      logId,
      organisationId: ctx.activeOrg.id,
    });

    return NextResponse.json({
      ok: true,
      success: result.success,
      attempts: result.attempts,
      webhook_id: result.webhook_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Replay failed";
    let statusCode = 400;
    if (message.includes("not found")) statusCode = 404;
    if (message.includes("Unauthorized")) statusCode = 403;

    return NextResponse.json(createErrorResponse(new Error(message)), {
      status: statusCode,
    });
  }
}
