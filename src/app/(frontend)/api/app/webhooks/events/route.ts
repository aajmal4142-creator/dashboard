import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySignature } from "@/lib/webhooks/webhookValidator";
import { getWebhook } from "@/lib/webhooks/webhookService";
import { triggerWebhooks } from "@/lib/webhooks/webhookQueue";
import { ApiError, ErrorCodes, createErrorResponse } from "@/lib/webhooks";

const WebhookEventSchema = z.object({
  event_type: z.enum(["datapoint.created", "datapoint.updated"]),
  organisationId: z.string().min(1),
  webhook_id: z.string().min(1),
  payload: z.object({
    datapoint_id: z.string().min(1),
    metricKey: z.string().min(1),
    value: z.number().nullable().optional(),
    quality: z.enum(["measured", "calculated", "estimated", "missing"]),
    timestamp: z.string(),
  }),
});

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-webhook-signature");
    if (!signature) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            ErrorCodes.INVALID_SIGNATURE,
            400,
            "Missing x-webhook-signature header",
          ),
        ),
        { status: 400 },
      );
    }

    const rawBody = await req.text();
    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.INVALID_REQUEST, 400, "Invalid JSON body"),
        ),
        { status: 400 },
      );
    }

    // Validate event structure
    const event = WebhookEventSchema.parse(body);

    // Get webhook to verify signature
    const webhook = await getWebhook(event.webhook_id);
    if (!webhook) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.WEBHOOK_NOT_FOUND, 404, "Webhook not found"),
        ),
        { status: 404 },
      );
    }

    // Verify organization matches
    if (webhook.organisation !== event.organisationId) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.UNAUTHORIZED, 403, "Organization mismatch"),
        ),
        { status: 403 },
      );
    }

    // Verify webhook is active
    if (webhook.status !== "active") {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.INVALID_REQUEST, 400, "Webhook is not active"),
        ),
        { status: 400 },
      );
    }

    // Verify webhook handles this event type
    if (!webhook.events.includes(event.event_type)) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            ErrorCodes.INVALID_REQUEST,
            400,
            `Webhook does not handle ${event.event_type} events`,
          ),
        ),
        { status: 400 },
      );
    }

    // Verify HMAC signature
    const isValid = verifySignature({
      payload: rawBody,
      signature,
      secret: webhook.secret,
    });

    if (!isValid) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.INVALID_SIGNATURE, 401, "Invalid signature"),
        ),
        { status: 401 },
      );
    }

    // Trigger webhook delivery (async, non-blocking)
    triggerWebhooks(event).catch((err) => {
      console.error("[webhook] trigger error", err);
    });

    // Return 202 Accepted
    return NextResponse.json(
      {
        ok: true,
        message: "Event accepted for processing",
        event_id: `${event.webhook_id}-${event.payload.datapoint_id}`,
      },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid webhook event schema",
          code: ErrorCodes.INVALID_SCHEMA,
          details: err.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    return NextResponse.json(
      createErrorResponse(err instanceof Error ? err : new Error("Failed")),
      { status: statusCode },
    );
  }
}
