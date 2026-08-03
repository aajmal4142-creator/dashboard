import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";
import {
  docToCampaign,
  getOrgCampaign,
  isCampaignGoalType,
  isCampaignStatus,
} from "@/lib/engagement";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
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

/**
 * GET /api/app/engagement/campaigns/[id]
 * PUT — update
 * DELETE — remove (admin+)
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const campaign = await getOrgCampaign(payload, ctx.activeOrg.id, id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      campaign,
      canWrite: canWrite(ctx.role),
      canDelete: canDelete(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Engagement campaign get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
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

    const body = (await req.json()) as Record<string, unknown>;

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : existing.title;
    const status = body.status !== undefined ? body.status : existing.status;
    if (!isCampaignStatus(status)) {
      return NextResponse.json(
        {
          error: "status must be draft, active, completed, or cancelled",
        },
        { status: 400 },
      );
    }

    const goalType = body.goalType !== undefined ? body.goalType : existing.goalType;
    if (!isCampaignGoalType(goalType)) {
      return NextResponse.json(
        { error: "goalType must be participants or tco2e" },
        { status: 400 },
      );
    }

    let goalValue = existing.goalValue;
    if (body.goalValue !== undefined) {
      if (body.goalValue === null || body.goalValue === "") {
        goalValue = null;
      } else {
        const n =
          typeof body.goalValue === "number" ? body.goalValue : Number(body.goalValue);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: "goalValue must be a non-negative number or null" },
            { status: 400 },
          );
        }
        goalValue = n;
      }
    }

    let participantCount = existing.participantCount;
    if (body.participantCount !== undefined) {
      const n =
        typeof body.participantCount === "number"
          ? body.participantCount
          : Number(body.participantCount);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "participantCount must be a non-negative number" },
          { status: 400 },
        );
      }
      participantCount = n;
    }

    let achievedTco2e = existing.achievedTco2e;
    if (body.achievedTco2e !== undefined) {
      if (body.achievedTco2e === null || body.achievedTco2e === "") {
        achievedTco2e = null;
      } else {
        const n =
          typeof body.achievedTco2e === "number"
            ? body.achievedTco2e
            : Number(body.achievedTco2e);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: "achievedTco2e must be a non-negative number or null" },
            { status: 400 },
          );
        }
        achievedTco2e = n;
      }
    }

    const startParsed = parseOptionalDate(body.startDate, "startDate");
    if (!startParsed.ok) {
      return NextResponse.json({ error: startParsed.error }, { status: 400 });
    }
    const endParsed = parseOptionalDate(body.endDate, "endDate");
    if (!endParsed.ok) {
      return NextResponse.json({ error: endParsed.error }, { status: 400 });
    }

    const updated = await payload.update({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id,
      data: {
        title,
        status,
        goalType,
        goalValue,
        participantCount,
        achievedTco2e,
        startDate:
          startParsed.value === undefined ? existing.startDate : startParsed.value,
        endDate: endParsed.value === undefined ? existing.endDate : endParsed.value,
        linkCommuteChallenge:
          body.linkCommuteChallenge !== undefined
            ? Boolean(body.linkCommuteChallenge)
            : existing.linkCommuteChallenge,
        description:
          body.description !== undefined
            ? typeof body.description === "string" && body.description.trim()
              ? body.description.trim()
              : null
            : existing.description,
      },
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json({
      campaign: docToCampaign(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Engagement campaign update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canDelete(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgCampaign(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await payload.delete({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Engagement campaign delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
