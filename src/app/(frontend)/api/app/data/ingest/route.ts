import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { z } from "zod";
import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { assertMinRole } from "@/lib/access";
import { clientIp } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit/write";
import {
  checkOrgRateLimit,
  batchIngestDatapoints,
  ingestDatapoint,
  getRateLimitHeaders,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";
import { ensureOpenPeriod } from "@/lib/org/period";

const SingleDatapointSchema = z.object({
  metricKey: z.string().min(1),
  value: z.number().nullable().optional(),
  quality: z.enum(["measured", "calculated", "estimated", "missing"]),
  unit: z.string().optional(),
});

const BatchDatapointsSchema = z.array(SingleDatapointSchema).min(1).max(1000);

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();

    if (!ctx.activeOrg || !ctx.role) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            ErrorCodes.UNAUTHORIZED,
            403,
            "No active organisation. Finish onboarding or switch organisation.",
          ),
        ),
        { status: 403 },
      );
    }

    // Check ABAC: user must have create:datapoint:organisation
    const canCreate = await assertMinRole(ctx.activeOrg.id, "contributor");
    if (!canCreate) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.UNAUTHORIZED, 403, "Insufficient permissions to create datapoints"),
        ),
        { status: 403 },
      );
    }

    // Rate limiting
    const rateLimitResult = await checkOrgRateLimit(ctx.activeOrg.id);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.ok) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            429,
            `Rate limit exceeded. Max 1000 requests per hour.`,
          ),
        ),
        { status: 429, headers: rateLimitHeaders },
      );
    }

    // Ensure open period
    const periodId = await ensureOpenPeriod(
      ctx.activeOrg.id,
      ctx.activeOrg.plan,
      ctx.activeOrg.subscriptionStatus,
    );

    const body = await req.json();

    // Check if batch or single
    let datapoints: z.infer<typeof SingleDatapointSchema>[] = [];
    if (Array.isArray(body)) {
      datapoints = BatchDatapointsSchema.parse(body);
    } else {
      datapoints = [SingleDatapointSchema.parse(body)];
    }

    const payload = await getPayload({ config });
    const ip = clientIp(req);

    // Log request
    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "api.datapoint_ingest",
      entityType: "datapoints",
      entityId: "batch",
      ip,
      after: { count: datapoints.length },
    });

    if (datapoints.length === 1) {
      // Single ingest
      const result = await ingestDatapoint(
        ctx.activeOrg.id,
        periodId,
        datapoints[0],
        ctx.user.id,
      );
      return NextResponse.json({ ok: true, ...result }, {
        status: 201,
        headers: rateLimitHeaders,
      });
    } else {
      // Batch ingest
      const result = await batchIngestDatapoints(
        ctx.activeOrg.id,
        periodId,
        datapoints,
        ctx.user.id,
      );
      return NextResponse.json({ ok: true, ...result }, {
        status: 201,
        headers: rateLimitHeaders,
      });
    }
  } catch (err) {
    const payload = await getPayload({ config });
    const statusCode = err instanceof ApiError ? err.statusCode : 400;
    const message =
      err instanceof Error ? err.message : "Ingestion failed";

    if (err instanceof z.ZodError) {
      const formatted = err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));
      return NextResponse.json(
        {
          error: "Invalid request schema",
          code: ErrorCodes.INVALID_SCHEMA,
          details: formatted,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      createErrorResponse(err instanceof Error ? err : new Error(message)),
      { status: statusCode },
    );
  }
}
