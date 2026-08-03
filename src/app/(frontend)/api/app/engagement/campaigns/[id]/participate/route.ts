import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";
import { docToCampaign, getOrgCampaign } from "@/lib/engagement";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * POST /api/app/engagement/campaigns/[id]/participate
 * Increment participant count (optional +1 or explicit delta).
 * Optionally add tCO₂e toward an emissions goal.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgCampaign(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot record participation on a cancelled campaign" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    let delta = 1;
    if (body.count !== undefined) {
      const n = typeof body.count === "number" ? body.count : Number(body.count);
      if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
        return NextResponse.json(
          { error: "count must be a positive integer" },
          { status: 400 },
        );
      }
      delta = n;
    }

    let nextAchieved = existing.achievedTco2e;
    if (body.addTco2e !== undefined && body.addTco2e !== null && body.addTco2e !== "") {
      const add =
        typeof body.addTco2e === "number" ? body.addTco2e : Number(body.addTco2e);
      if (!Number.isFinite(add) || add < 0) {
        return NextResponse.json(
          { error: "addTco2e must be a non-negative number" },
          { status: 400 },
        );
      }
      nextAchieved = (existing.achievedTco2e ?? 0) + add;
    }

    const updated = await payload.update({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id,
      data: {
        participantCount: existing.participantCount + delta,
        achievedTco2e: nextAchieved,
      },
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json({
      campaign: docToCampaign(updated as unknown as Record<string, unknown>),
      added: delta,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Engagement participate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
