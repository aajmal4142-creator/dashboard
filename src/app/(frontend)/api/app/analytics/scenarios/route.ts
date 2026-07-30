import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type ScenarioScopeValue = "1" | "2" | "3";
type ScenarioCategory =
  "renewable" | "efficiency" | "behavior" | "fuel_switching" | "other";

function parseScopes(raw: unknown): ScenarioScopeValue[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["1", "2", "3"];
  const allowed = new Set(["1", "2", "3"]);
  const out: ScenarioScopeValue[] = [];
  for (const s of raw) {
    const v = String(s);
    if (allowed.has(v) && !out.includes(v as ScenarioScopeValue)) {
      out.push(v as ScenarioScopeValue);
    }
  }
  return out.length > 0 ? out : ["1", "2", "3"];
}

function parseCategory(raw: unknown): ScenarioCategory {
  const v = String(raw || "other");
  if (
    v === "renewable" ||
    v === "efficiency" ||
    v === "behavior" ||
    v === "fuel_switching" ||
    v === "other"
  ) {
    return v;
  }
  return "other";
}

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
 * Create new scenario (reduction %, scopes, category, timeline)
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = await getPayload({ config });

    const reductionPercent =
      typeof body.reductionPercent === "number"
        ? Math.min(100, Math.max(0, body.reductionPercent))
        : 0;
    const timelineYears =
      typeof body.timelineYears === "number" && body.timelineYears >= 1
        ? body.timelineYears
        : Math.max(1, (body.targetYear || 0) - (body.baselineYear || 0) || 5);

    const scenario = await payload.create({
      collection: "scenarios",
      data: {
        organisation: ctx.activeOrg.id,
        name: body.name,
        type: body.type || "custom",
        baselineYear: body.baselineYear,
        targetYear: body.targetYear,
        reductionPercent,
        scopes: parseScopes(body.scopes),
        category: parseCategory(body.category),
        timelineYears,
        capex: typeof body.capex === "number" ? body.capex : 0,
        costPerTco2e:
          typeof body.costPerTco2e === "number" ? body.costPerTco2e : undefined,
        variables: body.variables || [],
        assumptions: body.assumptions || [],
        status: "draft",
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error("Scenario creation error:", error);
    return NextResponse.json({ error: "Failed to create scenario" }, { status: 500 });
  }
}
