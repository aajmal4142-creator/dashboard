import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { hasMinRole } from "@/lib/access/membership";
import {
  sendTestWebhookDelivery,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";

/**
 * POST /api/app/webhooks/[id]/test — send a signed test payload with retries
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const result = await sendTestWebhookDelivery({
      webhookId: id,
      organisationId: ctx.activeOrg.id,
    });

    return NextResponse.json({
      ok: true,
      success: result.success,
      attempts: result.attempts,
      webhook_id: id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test delivery failed";
    let statusCode = 400;
    if (message.includes("not found")) statusCode = 404;
    if (message.includes("Unauthorized")) statusCode = 403;

    return NextResponse.json(createErrorResponse(new Error(message)), {
      status: statusCode,
    });
  }
}
