import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * Duplicate open-period structure into a new period shell, or clone missing rows
 * from the previous period into the current open period.
 * Body: { mode: "structure" } clones metricKeys as quality:missing into the open period
 * from the most recent closed/prior period when open already exists with few rows.
 */
export async function POST(_req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const periods = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: ctx.activeOrg.id } },
    sort: "-endDate",
    limit: 5,
    overrideAccess: true,
  });

  const open = periods.docs.find((p) => p.status === "open");
  const prior = periods.docs.find((p) => p.id !== open?.id);
  if (!open || !prior) {
    return NextResponse.json(
      { error: "Need an open period and a prior period to duplicate structure." },
      { status: 400 },
    );
  }

  const priorDps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: prior.id } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });

  const openDps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: open.id } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });
  const existing = new Set(openDps.docs.map((d) => d.metricKey));

  let created = 0;
  for (const dp of priorDps.docs) {
    if (existing.has(dp.metricKey)) continue;
    await (
      payload.create as (args: {
        collection: "datapoints";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "datapoints",
      data: {
        organisation: ctx.activeOrg.id,
        period: open.id,
        metricKey: dp.metricKey,
        value: null,
        unit: dp.unit,
        quality: "missing",
        source: "manual",
        approvalState: "pending",
        supplierKey: "",
        provenance: "manual",
      },
      overrideAccess: true,
    });
    created += 1;
  }

  return NextResponse.json({
    ok: true,
    created,
    openPeriodId: open.id,
    priorPeriodId: prior.id,
  });
}
