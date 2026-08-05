import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";
import {
  docToCampaign,
  ensureCampaignPublicToken,
  isCampaignGoalType,
  isCampaignStatus,
  isSurveyMode,
  listOrgCampaigns,
} from "@/lib/engagement";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function parseOptionalDate(
  value: unknown,
  field: string,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a date string or null` };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return { ok: false, error: `${field} must be YYYY-MM-DD` };
  }
  return { ok: true, value: trimmed.slice(0, 10) };
}

function parseOptionalGoal(
  value: unknown,
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "goalValue must be a non-negative number or null" };
  }
  return { ok: true, value: n };
}

/**
 * GET /api/app/engagement/campaigns — list campaigns with progress
 * POST — create campaign
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && isCampaignStatus(statusParam) ? statusParam : undefined;
    if (statusParam && !status) {
      return NextResponse.json(
        {
          error: "status must be draft, active, completed, or cancelled",
        },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const campaigns = await listOrgCampaigns(payload, ctx.activeOrg.id, { status });

    return NextResponse.json({
      campaigns,
      total: campaigns.length,
      canWrite: canWrite(ctx.role),
      canDelete: ctx.role === "owner" || ctx.role === "admin",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Engagement campaigns list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const status = body.status === undefined ? "draft" : body.status;
    const goalType = body.goalType === undefined ? "participants" : body.goalType;
    const surveyMode = body.surveyMode === undefined ? "none" : body.surveyMode;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!isCampaignStatus(status)) {
      return NextResponse.json(
        {
          error: "status must be draft, active, completed, or cancelled",
        },
        { status: 400 },
      );
    }
    if (!isCampaignGoalType(goalType)) {
      return NextResponse.json(
        { error: "goalType must be participants or tco2e" },
        { status: 400 },
      );
    }
    if (!isSurveyMode(surveyMode)) {
      return NextResponse.json(
        { error: "surveyMode must be none or commute" },
        { status: 400 },
      );
    }

    const goalParsed = parseOptionalGoal(body.goalValue);
    if (!goalParsed.ok) {
      return NextResponse.json({ error: goalParsed.error }, { status: 400 });
    }
    const startParsed = parseOptionalDate(body.startDate, "startDate");
    if (!startParsed.ok) {
      return NextResponse.json({ error: startParsed.error }, { status: 400 });
    }
    const endParsed = parseOptionalDate(body.endDate, "endDate");
    if (!endParsed.ok) {
      return NextResponse.json({ error: endParsed.error }, { status: 400 });
    }

    const achievedRaw = body.achievedTco2e;
    let achievedTco2e: number | null | undefined = undefined;
    if (achievedRaw !== undefined) {
      if (achievedRaw === null || achievedRaw === "") {
        achievedTco2e = null;
      } else {
        const n = typeof achievedRaw === "number" ? achievedRaw : Number(achievedRaw);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: "achievedTco2e must be a non-negative number or null" },
            { status: 400 },
          );
        }
        achievedTco2e = n;
      }
    }

    const participantCount =
      body.participantCount === undefined
        ? 0
        : typeof body.participantCount === "number"
          ? body.participantCount
          : Number(body.participantCount);
    if (!Number.isFinite(participantCount) || participantCount < 0) {
      return NextResponse.json(
        { error: "participantCount must be a non-negative number" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        title,
        status,
        goalType,
        goalValue: goalParsed.value === undefined ? undefined : goalParsed.value,
        participantCount,
        achievedTco2e: achievedTco2e === undefined ? undefined : achievedTco2e,
        startDate: startParsed.value === undefined ? undefined : startParsed.value,
        endDate: endParsed.value === undefined ? undefined : endParsed.value,
        linkCommuteChallenge: Boolean(body.linkCommuteChallenge),
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : undefined,
        surveyMode,
        surveyResponseCount: 0,
      },
      depth: 0,
      overrideAccess: true,
    });

    let campaign = docToCampaign(created as unknown as Record<string, unknown>);
    if (status === "active" && !campaign.publicToken) {
      const token = await ensureCampaignPublicToken(
        payload,
        campaign.id,
        campaign.publicToken,
      );
      campaign = { ...campaign, publicToken: token };
    }

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Engagement campaign create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
