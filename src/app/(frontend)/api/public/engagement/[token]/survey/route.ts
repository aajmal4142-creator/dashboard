import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";
import { getCampaignByPublicToken } from "@/lib/engagement";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ token: string }> };

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/public/engagement/[token]/survey — unauthenticated commute-survey
 * submission. Increments participantCount + surveyResponseCount only.
 * No emission factor is available for a generic commute mode, so achievedTco2e
 * is intentionally left untouched rather than inventing a conversion.
 */
export async function POST(req: Request, ctx: RouteContext) {
  const { token } = await ctx.params;
  const limited = await rateLimit(`engagement-survey:${token}:${clientIp(req)}`, {
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const payload = await getPayload({ config });
    const campaign = await getCampaignByPublicToken(payload, token);
    if (!campaign) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    if (campaign.surveyMode !== "commute") {
      return NextResponse.json(
        { error: "This campaign is not accepting public survey responses" },
        { status: 400 },
      );
    }
    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "This campaign is not currently active" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const daysPerWeek = finiteOrNull(body.daysPerWeek);
    const kmPerDay = finiteOrNull(body.kmPerDay);
    if (daysPerWeek === null && kmPerDay === null) {
      return NextResponse.json(
        { error: "Provide commute days or distance." },
        { status: 400 },
      );
    }
    if (
      (daysPerWeek !== null && daysPerWeek < 0) ||
      (kmPerDay !== null && kmPerDay < 0)
    ) {
      return NextResponse.json(
        { error: "Values must be non-negative." },
        { status: 400 },
      );
    }

    await payload.update({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id: campaign.id,
      data: {
        participantCount: campaign.participantCount + 1,
        surveyResponseCount: campaign.surveyResponseCount + 1,
      },
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Public engagement survey submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
