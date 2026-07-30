import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  DEFAULT_EMISSIONS_STANDARD,
  EMISSIONS_STANDARD_LABELS,
  EMISSIONS_STANDARDS,
  isEmissionsStandard,
  resolveOrgEmissionsStandard,
  type EmissionsStandard,
} from "@/lib/factors";
import config from "@/payload.config";

/** GET org emissions methodology standard. */
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

  const standard = resolveOrgEmissionsStandard(org);
  return NextResponse.json({
    standard,
    label: EMISSIONS_STANDARD_LABELS[standard],
    options: EMISSIONS_STANDARDS.map((value) => ({
      value,
      label: EMISSIONS_STANDARD_LABELS[value],
    })),
    default: DEFAULT_EMISSIONS_STANDARD,
    canEdit: ctx.role === "owner" || ctx.role === "admin",
  });
}

/** PUT org emissions methodology standard — owner/admin. Recalc via next calc / draft rebuild. */
export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Only owners and admins can change the emissions standard." },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { standard?: string };
  if (!isEmissionsStandard(body.standard)) {
    return NextResponse.json(
      {
        error: `standard must be one of: ${EMISSIONS_STANDARDS.join(", ")}`,
      },
      { status: 400 },
    );
  }
  const standard: EmissionsStandard = body.standard;

  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const updated = await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      settings: {
        ...(existing.settings ?? {}),
        emissionsStandard: standard,
      },
    },
    overrideAccess: true,
  });

  return NextResponse.json({
    standard: resolveOrgEmissionsStandard(updated),
    label: EMISSIONS_STANDARD_LABELS[standard],
    note: "Applies on the next calculation and draft report rebuild. Final locked reports keep their pinned snapshot.",
  });
}
