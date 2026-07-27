import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

const STEP_IDS = ["sector", "baseline", "top3", "supplier", "publish"] as const;

async function deriveDone(organisationId: string): Promise<Record<string, boolean>> {
  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });

  const saved =
    org.guideProgress &&
    typeof org.guideProgress === "object" &&
    !Array.isArray(org.guideProgress)
      ? (org.guideProgress as Record<string, boolean>)
      : {};

  const sectorDone = Boolean(org.sector && org.country) || Boolean(saved.sector);
  const baselineDone = Boolean(org.onboardedAt) || Boolean(saved.baseline);

  let top3Done = Boolean(saved.top3);
  try {
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { status: { equals: "open" } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    const periodId = periods.docs[0]?.id;
    if (periodId && !top3Done) {
      const present = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            { period: { equals: periodId } },
          ],
        },
        limit: 50,
        overrideAccess: true,
      });
      const filled = present.docs.filter(
        (d) => d.quality !== "missing" && d.value != null,
      ).length;
      top3Done = filled >= 3;
    }
  } catch {
    /* keep saved.top3 */
  }

  let supplierDone = Boolean(saved.supplier);
  try {
    const suppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    });
    supplierDone = suppliers.totalDocs > 0 || supplierDone;
  } catch {
    /* keep saved */
  }

  let publishDone = Boolean(saved.publish);
  try {
    const reports = await payload.find({
      collection: "reports",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    });
    publishDone = reports.totalDocs > 0 || publishDone;
  } catch {
    /* keep saved */
  }

  return {
    sector: sectorDone,
    baseline: baselineDone,
    top3: top3Done,
    supplier: supplierDone,
    publish: publishDone,
  };
}

/** Org-scoped first-report checklist — derived from real state, mergeable with manual ticks. */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }
  try {
    const done = await deriveDone(ctx.activeOrg.id);
    return NextResponse.json({ done });
  } catch {
    return NextResponse.json({
      done: {
        sector: false,
        baseline: Boolean(ctx.activeOrg.onboardedAt),
        top3: false,
        supplier: false,
        publish: false,
      },
    });
  }
}

export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Viewers cannot update the guide checklist" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { done?: Record<string, boolean> };
  const next: Record<string, boolean> = {};
  for (const id of STEP_IDS) {
    next[id] = Boolean(body.done?.[id]);
  }

  const payload = await getPayload({ config });
  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: { guideProgress: next },
    overrideAccess: true,
  });

  try {
    const done = await deriveDone(ctx.activeOrg.id);
    return NextResponse.json({ ok: true, done });
  } catch {
    return NextResponse.json({ ok: true, done: next });
  }
}
