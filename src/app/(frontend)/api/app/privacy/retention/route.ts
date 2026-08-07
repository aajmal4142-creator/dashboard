import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type RetentionBody = {
  dpdEnabled?: boolean;
  retentionDays?: {
    datapoints?: number | null;
    evidence?: number | null;
  };
};

/** GET current org retention policy / DPDP opt-in (Y06). */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const privacy = org.settings?.privacy;
  return NextResponse.json({
    dpdEnabled: Boolean(privacy?.dpdEnabled),
    retentionDays: {
      datapoints: privacy?.retentionDays?.datapoints ?? null,
      evidence: privacy?.retentionDays?.evidence ?? null,
    },
    canEdit: ctx.role === "owner" || ctx.role === "admin",
  });
}

/** Clamp a provided retention value; null/negative/non-finite clears it to indefinite. */
function normalizeDays(value: number | null): number | null {
  if (value === null) return null;
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/** PUT retention policy / DPDP opt-in — owner/admin only. */
export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as RetentionBody;
  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });
  const existingPrivacy = existing.settings?.privacy;

  const datapointsRaw = body.retentionDays?.datapoints;
  const evidenceRaw = body.retentionDays?.evidence;
  const nextDatapoints =
    datapointsRaw === undefined
      ? (existingPrivacy?.retentionDays?.datapoints ?? null)
      : normalizeDays(datapointsRaw);
  const nextEvidence =
    evidenceRaw === undefined
      ? (existingPrivacy?.retentionDays?.evidence ?? null)
      : normalizeDays(evidenceRaw);

  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      settings: {
        privacy: {
          dpdEnabled:
            body.dpdEnabled !== undefined
              ? body.dpdEnabled
              : Boolean(existingPrivacy?.dpdEnabled),
          retentionDays: {
            datapoints: nextDatapoints,
            evidence: nextEvidence,
          },
        },
      },
    },
    overrideAccess: true,
  });

  return NextResponse.json({
    ok: true,
    dpdEnabled:
      body.dpdEnabled !== undefined
        ? body.dpdEnabled
        : Boolean(existingPrivacy?.dpdEnabled),
    retentionDays: { datapoints: nextDatapoints, evidence: nextEvidence },
  });
}
