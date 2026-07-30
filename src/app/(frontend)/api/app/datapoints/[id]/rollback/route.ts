import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { rollbackDatapoint } from "@/lib/data/recordVersion";
import config from "@/payload.config";

type Props = { params: Promise<{ id: string }> };

/**
 * POST /api/app/datapoints/[id]/rollback — restore datapoint to a prior version snapshot.
 * Body: { versionId: string, reason?: string }
 */
export async function POST(req: Request, { params }: Props) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Viewers cannot rollback datapoints" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    versionId?: string;
    reason?: string;
  };
  if (!body.versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const payload = await getPayload({ config });

  const dp = await payload.findByID({
    collection: "datapoints",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof dp.organisation === "string" ? dp.organisation : dp.organisation?.id;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodId = typeof dp.period === "string" ? dp.period : dp.period?.id;
  if (periodId) {
    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    });
    if (period.status !== "open") {
      return NextResponse.json(
        { error: "Reporting period is locked or published. Rollback is refused." },
        { status: 409 },
      );
    }
  }

  try {
    const result = await rollbackDatapoint(payload, {
      organisationId: ctx.activeOrg.id,
      datapointId: id,
      versionId: body.versionId,
      actorId: ctx.user.id,
      reason: body.reason ?? null,
    });

    const restored = await payload.findByID({
      collection: "datapoints",
      id,
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json({
      ok: true,
      id: result.id,
      versionNumber: result.versionNumber,
      datapoint: {
        id: restored.id,
        metricKey: restored.metricKey,
        value: typeof restored.value === "number" ? restored.value : null,
        unit: restored.unit ?? null,
        quality: restored.quality,
        approvalState: restored.approvalState ?? "pending",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rollback failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
