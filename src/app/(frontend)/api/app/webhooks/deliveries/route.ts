import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentContext } from "@/lib/auth";
import { hasMinRole } from "@/lib/access/membership";
import {
  listWebhookDeliveries,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";

const QuerySchema = z.object({
  status: z.enum(["success", "failed", "retrying"]).optional(),
  webhook_id: z.string().min(1).optional(),
  dead_letter: z
    .enum(["1", "true", "yes"])
    .optional()
    .transform((v) => Boolean(v)),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * GET /api/app/webhooks/deliveries — delivery log + dead-letter queue
 */
export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      webhook_id: url.searchParams.get("webhook_id") ?? undefined,
      dead_letter: url.searchParams.get("dead_letter") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query",
          code: ErrorCodes.INVALID_SCHEMA,
          details: parsed.error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const deliveries = await listWebhookDeliveries({
      organisationId: ctx.activeOrg.id,
      status: parsed.data.status,
      webhookId: parsed.data.webhook_id,
      deadLetterOnly: parsed.data.dead_letter === true,
      limit: parsed.data.limit,
    });

    return NextResponse.json({
      ok: true,
      deliveries,
      dead_letter_count: deliveries.filter((d) => d.is_dead_letter).length,
    });
  } catch (err) {
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    return NextResponse.json(
      createErrorResponse(err instanceof Error ? err : new Error("Failed")),
      { status: statusCode },
    );
  }
}
