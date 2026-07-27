import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ACTIVE_ORG_COOKIE, getCurrentContext } from "@/lib/auth";
import { parseRevenueBand } from "@/lib/obligations";
import { persistDerivedObligations } from "@/lib/obligations/persist";
import config from "@/payload.config";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  // New users with no org may create one; existing orgs require owner/admin.
  if (
    ctx.activeOrg &&
    (ctx.role === "viewer" || ctx.role === "contributor" || !ctx.role)
  ) {
    return NextResponse.json(
      { error: "Owner or admin required to complete onboarding" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    sector?: string;
    headcount?: string;
    country?: string;
    revenueBand?: string;
    orgName?: string;
  };

  const payload = await getPayload({ config });
  let orgId = ctx.activeOrg?.id ?? null;
  const sector = body.sector ?? ctx.activeOrg?.sector ?? "C25";
  const country = body.country ?? ctx.activeOrg?.country ?? "GB";
  const revenueBand = parseRevenueBand(body.revenueBand);
  const employeeCount = body.headcount ? Number(body.headcount) : null;
  const onboardedAt = new Date().toISOString();

  if (!orgId) {
    const baseName =
      body.orgName?.trim() ||
      `${ctx.user.firstName ?? "My"} organisation`.trim() ||
      "My organisation";
    const baseSlug = `${slugify(baseName)}-${Date.now().toString(36)}`;
    const org = await payload.create({
      collection: "organisations",
      data: {
        name: baseName,
        slug: baseSlug,
        type: "company",
        sector,
        country,
        employeeCount: employeeCount ?? undefined,
        revenueBand: revenueBand ?? undefined,
        plan: "free",
        subscriptionStatus: "none",
        onboardedAt,
      },
      overrideAccess: true,
    });
    orgId = org.id;

    await payload.create({
      collection: "memberships",
      data: {
        organisation: orgId,
        user: ctx.user.id,
        role: "owner",
        status: "active",
        acceptedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });
  } else {
    await payload.update({
      collection: "organisations",
      id: orgId,
      data: {
        sector,
        country,
        employeeCount: employeeCount ?? undefined,
        revenueBand: revenueBand ?? undefined,
        onboardedAt,
      },
      overrideAccess: true,
    });
  }

  const persisted = await persistDerivedObligations(payload, {
    organisationId: orgId,
    actorId: ctx.user.id,
    input: {
      country,
      employeeCount,
      revenueBand,
    },
  });

  const primary = persisted.obligations[0]?.result ?? null;

  const res = NextResponse.json({
    ok: true,
    organisationId: orgId,
    baselineDrift: persisted.baselineDrift,
    voluntary: persisted.voluntary,
    obligation: primary
      ? {
          name: primary.name,
          wave: primary.wave,
          jurisdiction: primary.jurisdiction,
          standardVersion: primary.standardVersion,
          firstReportingFY: primary.firstReportingFY,
          filingDeadline: primary.filingDeadline,
          reason: primary.reason,
          confidence: primary.confidence,
          daysToFiling:
            primary.filingDeadline != null
              ? Math.ceil(
                  (new Date(primary.filingDeadline).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                )
              : null,
        }
      : null,
  });
  res.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
