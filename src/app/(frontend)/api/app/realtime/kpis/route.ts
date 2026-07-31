/**
 * REST KPI snapshot — polling fallback when SSE is unavailable.
 * Same public fields as the realtime stream; Membership-scoped.
 */

import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getApiContext } from "@/lib/auth";
import { computeOrgKpiSnapshot, toPublicKpiPayload } from "@/lib/realtime";
import config from "@/payload.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const gate = await getApiContext();
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "Authentication required. Sign in and select an organisation." },
      { status: 401 },
    );
  }

  try {
    const payload = await getPayload({ config });
    const snapshot = await computeOrgKpiSnapshot(payload, ctx.activeOrg.id);
    return NextResponse.json({
      ok: true,
      transport: "rest",
      ...toPublicKpiPayload(snapshot),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load KPIs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
