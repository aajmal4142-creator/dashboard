import { getPayload } from "payload";
import { NextResponse } from "next/server";

import type { AuthContext } from "@/lib/auth";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  calculateRiskScore,
  getRiskScoreWithExplanation,
  upsertRiskMitigation,
} from "@/lib/suppliers";
import config from "@/payload.config";
import type { Supplier } from "@/payload-types";

function orgIdOf(organisation: Supplier["organisation"]): string {
  if (typeof organisation === "object" && organisation !== null) {
    return String(organisation.id);
  }
  return String(organisation);
}

async function assertSupplierAccess(
  id: string,
): Promise<
  | { ok: true; ctx: AuthContext; supplier: Supplier }
  | { ok: false; response: NextResponse }
> {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No active organisation" }, { status: 403 }),
    };
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
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const payload = await getPayload({ config });
  const supplier = await payload.findByID({
    collection: "suppliers",
    id,
    overrideAccess: true,
  });

  if (!supplier || orgIdOf(supplier.organisation) !== ctx.activeOrg.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  return { ok: true, ctx, supplier };
}

/**
 * GET /api/app/suppliers/[id]/risk-breakdown
 * Aligns with Feature 10 "risk-score" — score details + pillar breakdown.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await assertSupplierAccess(id);
  if (!access.ok) return access.response;

  const breakdown = await calculateRiskScore(id);
  if (!breakdown) {
    return NextResponse.json(
      {
        error: "Could not calculate risk score. Check supplier ESG data and try again.",
      },
      { status: 500 },
    );
  }

  const explanation = await getRiskScoreWithExplanation(id);
  const { supplier } = access;

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

/**
 * PATCH /api/app/suppliers/[id]/risk-breakdown
 * Upsert a mitigation action for tracking.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await assertSupplierAccess(id);
  if (!access.ok) return access.response;

  const canWrite = await requirePermission(
    access.ctx.user.id,
    access.ctx.activeOrg!.id,
    "edit",
    "supplier",
    access.ctx.activeOrg!.id,
    "organisation",
  );
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    id?: string;
    action?: string;
    status?: "open" | "in_progress" | "done";
  };

  if (!body.action || !body.status) {
    return NextResponse.json(
      { error: "action and status are required" },
      { status: 400 },
    );
  }

  const mitigations = await upsertRiskMitigation(id, {
    id: body.id,
    action: body.action,
    status: body.status,
  });

  if (!mitigations) {
    return NextResponse.json(
      { error: "Could not save mitigation. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ mitigations });
}
