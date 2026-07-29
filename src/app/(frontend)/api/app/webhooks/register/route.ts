import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth";
import { hasMinRole } from "@/lib/access/membership";
import {
  registerWebhook,
  listWebhooks,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";

const RegisterWebhookSchema = z.object({
  endpoint_url: z.string().url(),
  events: z.array(z.enum(["datapoint.created", "datapoint.updated"])).min(1),
});

export async function POST(req: Request) {
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

    const body = RegisterWebhookSchema.parse(await req.json());
    const webhook = await registerWebhook(
      ctx.activeOrg.id,
      body.endpoint_url,
      body.events,
      ctx.user.id,
    );

    return NextResponse.json(
      {
        ok: true,
        webhook_id: webhook.webhook_id,
        endpoint_url: webhook.endpoint_url,
        secret: webhook.secret,
        events: webhook.events,
        status: webhook.status,
        createdAt: webhook.createdAt,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request schema",
          code: ErrorCodes.INVALID_SCHEMA,
          details: err.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const statusCode = err instanceof ApiError ? err.statusCode : 400;
    return NextResponse.json(
      createErrorResponse(err instanceof Error ? err : new Error("Failed")),
      { status: statusCode },
    );
  }
}

export async function GET() {
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

    const webhooks = await listWebhooks(ctx.activeOrg.id);

    return NextResponse.json({
      ok: true,
      webhooks: webhooks.map((w) => ({
        webhook_id: w.webhook_id,
        endpoint_url: w.endpoint_url,
        events: w.events,
        status: w.status,
        last_triggered_at: w.last_triggered_at,
        retry_count: w.retry_count,
        createdAt: w.createdAt,
      })),
    });
  } catch (err) {
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    return NextResponse.json(
      createErrorResponse(err instanceof Error ? err : new Error("Failed")),
      { status: statusCode },
    );
  }
}
