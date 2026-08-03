import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { coverageForPathway, isAssuranceLevel } from "@/lib/assurance/pathways";
import type { AssuranceEngagement } from "@/lib/assurance";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export async function GET() {
  const auth = await getCurrentContext();

  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });

  try {
    const [engagements, periods] = await Promise.all([
      payload.find({
        collection: "assurance-engagements",
        where: {
          organisation: {
            equals: auth.activeOrg.id,
          },
        },
        sort: "-requestedAt",
        limit: 100,
        overrideAccess: true,
      }),
      payload.find({
        collection: "reporting-periods",
        where: {
          organisation: {
            equals: auth.activeOrg.id,
          },
        },
        sort: "-startDate",
        limit: 50,
        overrideAccess: true,
      }),
    ]);

    const withCoverage = engagements.docs.map((doc) => {
      const level = isAssuranceLevel(doc.assuranceLevel) ? doc.assuranceLevel : "limited";
      const completedIds = (doc.pathwayCheckpoints ?? [])
        .map((r) => r.checkpointId)
        .filter(Boolean);
      return {
        ...doc,
        assuranceLevel: level,
        pathwayCoverage: coverageForPathway(level, completedIds),
      };
    });

    return NextResponse.json({
      engagements: withCoverage,
      total: engagements.totalDocs,
      periods: periods.docs.map((p) => ({
        id: p.id,
        label: p.label ?? p.id,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching engagements:", error);
    return NextResponse.json({ error: "Failed to fetch engagements" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await getCurrentContext();

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canWrite =
    auth.role === "owner" || auth.role === "admin" || auth.role === "contributor";
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Partial<AssuranceEngagement>;

    if (!body.reportingPeriod || !body.provider) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!body.provider.name?.trim() || !body.provider.email?.trim()) {
      return NextResponse.json(
        { error: "Provider name and email are required" },
        { status: 400 },
      );
    }

    const validFrameworks = ["csrd", "brsr", "gri", "sasb"] as const;
    const framework =
      body.framework &&
      validFrameworks.includes(body.framework as (typeof validFrameworks)[number])
        ? (body.framework as (typeof validFrameworks)[number])
        : undefined;

    const validScopes = ["scope1", "scope2", "scope3", "all"] as const;
    const scope =
      body.scope && validScopes.includes(body.scope as (typeof validScopes)[number])
        ? (body.scope as (typeof validScopes)[number])
        : "all";

    const assuranceLevel = isAssuranceLevel(body.assuranceLevel)
      ? body.assuranceLevel
      : "limited";

    const payload = await getPayload({ config });

    const period = await payload.findByID({
      collection: "reporting-periods",
      id: body.reportingPeriod,
      overrideAccess: true,
    });
    const periodOrg =
      typeof period.organisation === "object"
        ? period.organisation.id
        : String(period.organisation);
    if (periodOrg !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Invalid reporting period" }, { status: 400 });
    }

    const engagement = await payload.create({
      collection: "assurance-engagements",
      data: {
        organisation: auth.activeOrg.id,
        reportingPeriod: body.reportingPeriod,
        provider: {
          name: body.provider.name.trim(),
          email: body.provider.email.trim(),
          contactPerson: body.provider.contactPerson,
          providerOrg: body.provider.providerOrg,
        },
        scope,
        framework,
        assuranceLevel,
        pathwayCheckpoints: [],
        status: "draft",
        requestedAt: new Date().toISOString(),
        dataGaps: body.dataGaps || [],
        notes: body.notes,
        createdBy: auth.user.id,
      },
      overrideAccess: true,
    });

    return NextResponse.json(
      {
        engagement: {
          ...engagement,
          pathwayCoverage: coverageForPathway(assuranceLevel, []),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating engagement:", error);
    return NextResponse.json({ error: "Failed to create engagement" }, { status: 500 });
  }
}
