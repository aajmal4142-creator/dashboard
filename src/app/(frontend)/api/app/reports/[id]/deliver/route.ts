import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { deliverReportWebhooks } from "@/lib/webhooks/reportDelivery";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  webhook_id: z.string().uuid().optional(),
});

function orgIdOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

/**
 * POST /api/app/reports/[id]/deliver
 * Manually trigger report.generated webhook delivery for a published report.
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: reportId } = await ctx.params;
  const payload = await getPayload({ config });

  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (orgIdOf(report.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (report.status !== "published") {
    return NextResponse.json(
      {
        error:
          "Only published (verified) reports can be delivered via webhook. Publish the report first.",
      },
      { status: 409 },
    );
  }

  let body: z.infer<typeof BodySchema> = {};
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: err.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    // Empty body is allowed
    body = {};
  }

  const result = await deliverReportWebhooks({
    reportId,
    organisationId: auth.activeOrg.id,
    webhookId: body.webhook_id,
  });

  if (!result.ok && result.deliveries.length === 0 && result.reason) {
    const status = result.reason.includes("not published") ? 409 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    ok: result.ok,
    reason: result.reason ?? null,
    event: "report.generated",
    report_id: reportId,
    deliveries: result.deliveries,
  });
}
