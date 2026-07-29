import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/analytics/scenarios
 * List scenarios for organization
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });

    const scenarios = await payload.find({
      collection: "scenarios",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      sort: "-createdAt",
    });

    return NextResponse.json({
      scenarios: scenarios.docs,
      total: scenarios.totalDocs,
    });
  } catch (error) {
    console.error("Scenarios list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/analytics/scenarios
 * Create new scenario
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = await getPayload({ config });

    const scenario = await payload.create({
      collection: "scenarios",
      data: {
        organisation: ctx.activeOrg.id,
        name: body.name,
        type: body.type,
        baselineYear: body.baselineYear,
        targetYear: body.targetYear,
        variables: body.variables,
        assumptions: body.assumptions || [],
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error("Scenario creation error:", error);
    return NextResponse.json({ error: "Failed to create scenario" }, { status: 500 });
  }
}
