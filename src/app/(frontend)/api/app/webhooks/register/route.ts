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
  type RegisterWebhookOptions,
} from "@/lib/webhooks";

const WebhookEventSchema = z.enum([
  "datapoint.created",
  "datapoint.updated",
  "report.generated",
]);

const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(0).max(120_000).default(1000),
  exponentialBackoff: z.boolean().default(true),
});

const AuthenticationSchema = z.object({
  type: z.enum(["bearer", "apikey", "basic"]),
  value: z.string().min(1).optional(),
  apiKeyHeader: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

const RegisterWebhookSchema = z.object({
  endpoint_url: z.string().url(),
  events: z.array(WebhookEventSchema).min(1),
  headers: z.record(z.string(), z.string()).optional(),
  authentication: AuthenticationSchema.optional(),
  retry_policy: RetryPolicySchema.optional(),
});

/** @deprecated Prefer POST /api/app/webhooks — kept for compatibility. */
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
    const options: RegisterWebhookOptions = {};
    if (body.headers) options.headers = body.headers;
    if (body.authentication) options.authentication = body.authentication;
    if (body.retry_policy) options.retry_policy = body.retry_policy;

    const webhook = await registerWebhook(
      ctx.activeOrg.id,
      body.endpoint_url,
      body.events,
      ctx.user.id,
      options,
    );

    return NextResponse.json(
      {
        ok: true,
        webhook_id: webhook.webhook_id,
        endpoint_url: webhook.endpoint_url,
        secret: webhook.secret,
        events: webhook.events,
        status: webhook.status,
        retry_policy: webhook.retry_policy ?? null,
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
        retry_policy: w.retry_policy ?? null,
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
