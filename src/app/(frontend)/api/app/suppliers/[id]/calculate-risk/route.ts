import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { calculateRiskScore } from "@/lib/suppliers";
import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * POST /api/app/suppliers/[id]/calculate-risk
 * Feature 10 calculate-risk — recalculate and return ESG pillar breakdown.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const supplier = await payload.findByID({
    collection: "suppliers",
    id,
    overrideAccess: true,
  });

  if (
    !supplier ||
    (typeof supplier.organisation === "object" && supplier.organisation !== null
      ? String(supplier.organisation.id)
      : String(supplier.organisation)) !== ctx.activeOrg.id
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const breakdown = await calculateRiskScore(id);
  if (!breakdown) {
    return NextResponse.json(
      { error: "Could not calculate risk score. Check supplier ESG data and try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    supplierId: id,
    breakdown,
    highRiskAlert: breakdown.highRiskAlert,
  });
}
