import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { calculateRiskScore, getRiskScoreWithExplanation } from "@/lib/suppliers";
import config from "@/payload.config";

export async function GET(
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
    "view",
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

  if (!supplier || supplier.organisation !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const breakdown = await calculateRiskScore(id);
  if (!breakdown) {
    return NextResponse.json(
      { error: "Could not calculate risk score" },
      { status: 500 },
    );
  }

  const explanation = await getRiskScoreWithExplanation(id);

  return NextResponse.json({
    supplier: {
      id: supplier.id,
      name: supplier.name,
      category: supplier.category,
      annualSpend: supplier.annualSpend,
    },
    breakdown,
    explanation: explanation?.explanation ?? null,
  });
}
