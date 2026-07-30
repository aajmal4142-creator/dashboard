import { getPayload } from "payload";
import { NextResponse } from "next/server";
import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { clientIp } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit/write";
import {
  checkOrgRateLimit,
  processIngest,
  getRateLimitHeaders,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";
import { ensureOpenPeriod } from "@/lib/org/period";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";

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

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            ErrorCodes.UNAUTHORIZED,
            403,
            "Permission denied: create datapoint for this organisation is required.",
          ),
        ),
        { status: 403 },
      );
    }

    const rateLimitResult = await checkOrgRateLimit(ctx.activeOrg.id);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.ok) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            429,
            "Rate limit exceeded. Max 1000 requests per hour.",
          ),
        ),
        { status: 429, headers: rateLimitHeaders },
      );
    }

    let periodId: string;
    try {
      periodId = await ensureOpenPeriod(
        ctx.activeOrg.id,
        ctx.activeOrg.plan,
        ctx.activeOrg.subscriptionStatus,
      );
    } catch (err) {
      if (err instanceof BillingDeniedError) {
        return NextResponse.json(billingDeniedResponse(err), { status: 402 });
      }
      throw err;
    }

    const url = new URL(req.url);
    const dryRunQuery = url.searchParams.get("dryRun");
    const dryRunDefault =
      dryRunQuery === "true" || dryRunQuery === "1"
        ? true
        : dryRunQuery === "false" || dryRunQuery === "0"
          ? false
          : false;

    const body = await req.json();

    const payload = await getPayload({ config });
    const ip = clientIp(req);

    const result = await processIngest({
      organisationId: ctx.activeOrg.id,
      periodId,
      body,
      actorId: ctx.user.id,
      dryRunDefault,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "api.datapoint_ingest",
      entityType: "datapoints",
      entityId: result.batchId,
      ip,
      after: {
        batchId: result.batchId,
        dryRun: result.dryRun,
        recordsProcessed: result.recordsProcessed,
        recordsSkipped: result.recordsSkipped,
        recordsFailed: result.recordsFailed,
      },
    });

    const status =
      result.recordsProcessed === 0 && result.recordsFailed > 0
        ? 400
        : result.dryRun
          ? 200
          : 201;

    return NextResponse.json(result, {
      status,
      headers: rateLimitHeaders,
    });
  } catch (err) {
    const statusCode = err instanceof ApiError ? err.statusCode : 400;
    const message = err instanceof Error ? err.message : "Ingestion failed";

    return NextResponse.json(
      createErrorResponse(err instanceof Error ? err : new Error(message)),
      { status: statusCode },
    );
  }
}
