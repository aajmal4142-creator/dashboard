import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";
import { writeDatapoint } from "@/lib/data";
import { ensureOpenPeriod } from "@/lib/org/period";
import config from "@/payload.config";

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Viewers cannot write datapoints" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    metricKey?: string;
    value?: number | null;
    quality?: "measured" | "calculated" | "estimated" | "missing";
    unit?: string;
    assignedTo?: string | null;
  };
  if (!body.metricKey || !body.quality) {
    return NextResponse.json(
      { error: "metricKey and quality required" },
      { status: 400 },
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

  const payload = await getPayload({ config });
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  if (period.status !== "open") {
    return NextResponse.json(
      { error: "Reporting period is locked or published. Writes are refused." },
      { status: 409 },
    );
  }

  try {
    const result = await writeDatapoint(payload, {
      organisationId: ctx.activeOrg.id,
      periodId,
      metricKey: body.metricKey,
      value: body.quality === "missing" ? null : (body.value ?? null),
      unit: body.unit,
      quality: body.quality,
      source: "manual",
      actorId: ctx.user.id,
      assignedTo: body.assignedTo,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
