import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  compareScenarioTrajectories,
  type TrajectoryPoint,
} from "@/lib/analytics/scenarioCalculator";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type StoredResults = {
  impact?: {
    baseline?: { total?: number };
    trajectory?: TrajectoryPoint[];
  };
};

/**
 * GET /api/app/analytics/scenarios/compare?ids=id1,id2,id3
 * Compare up to 3 calculated scenarios side-by-side.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Provide up to 3 scenario ids via ?ids=a,b,c" },
      { status: 400 },
    );
  }

  try {
    const payload = await getPayload({ config });
    const scenarios = [];

    for (const id of ids) {
      const doc = await payload.findByID({
        collection: "scenarios",
        id,
        depth: 0,
      });
      const orgId =
        typeof doc.organisation === "string" ? doc.organisation : doc.organisation?.id;
      if (!doc || orgId !== ctx.activeOrg.id) {
        return NextResponse.json({ error: `Scenario not found: ${id}` }, { status: 404 });
      }
      scenarios.push(doc);
    }

    const withTrajectories = scenarios
      .map((s) => {
        const results = s.results as StoredResults | null;
        const trajectory = results?.impact?.trajectory;
        if (!trajectory || trajectory.length === 0) return null;
        return {
          id: s.id,
          name: s.name,
          trajectory,
          baselineTotal:
            results?.impact?.baseline?.total ?? trajectory[0]?.emissions ?? 0,
          status: s.status,
          impact: results?.impact ?? null,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (withTrajectories.length === 0) {
      return NextResponse.json(
        {
          error: "Selected scenarios have no calculated results. Run calculate first.",
        },
        { status: 400 },
      );
    }

    const baselineTotal = withTrajectories[0]!.baselineTotal;
    const baselineYear =
      withTrajectories[0]!.trajectory[0]?.year ?? scenarios[0]!.baselineYear;

    const comparison = compareScenarioTrajectories(
      baselineTotal,
      baselineYear,
      withTrajectories.map((s) => ({
        id: s.id,
        name: s.name,
        trajectory: s.trajectory,
      })),
    );

    return NextResponse.json({
      comparison,
      scenarios: withTrajectories,
    });
  } catch (error) {
    console.error("Scenario compare error:", error);
    return NextResponse.json({ error: "Failed to compare scenarios" }, { status: 500 });
  }
}
