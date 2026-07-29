import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import type { AssuranceEngagement } from "@/lib/assurance";

export async function GET() {
  const auth = await getCurrentContext();

  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });

  try {
    const engagements = await payload.find({
      collection: "assurance-engagements",
      where: {
        organisation: {
          equals: auth.activeOrg.id,
        },
      },
      limit: 100,
    });

    return NextResponse.json({
      engagements: engagements.docs,
      total: engagements.totalDocs,
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

  try {
    const body = (await req.json()) as Partial<AssuranceEngagement>;

    // Validate required fields
    if (!body.reportingPeriod || !body.provider) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    const payload = await getPayload({ config });

    // Create new engagement in draft status
    const engagement = await payload.create({
      collection: "assurance-engagements",
      data: {
        organisation: auth.activeOrg.id,
        reportingPeriod: body.reportingPeriod,
        provider: {
          name: body.provider.name || "",
          email: body.provider.email || "",
          contactPerson: body.provider.contactPerson,
          providerOrg: body.provider.providerOrg,
        },
        scope,
        framework,
        status: "draft",
        requestedAt: new Date().toISOString(),
        dataGaps: body.dataGaps || [],
        notes: body.notes,
        createdBy: auth.user.id,
      },
    });

    return NextResponse.json({ engagement }, { status: 201 });
  } catch (error) {
    console.error("Error creating engagement:", error);
    return NextResponse.json({ error: "Failed to create engagement" }, { status: 500 });
  }
}
