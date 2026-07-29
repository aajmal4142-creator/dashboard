import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import { DataGapDetector } from "@/lib/assurance";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();

  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const payload = await getPayload({ config });

    // Verify engagement exists
    const engagement = await payload.findByID({
      collection: "assurance-engagements" as any,
      id,
      overrideAccess: true,
    });

    const engagementOrgId =
      typeof engagement.organisation === "object"
        ? engagement.organisation.id
        : String(engagement.organisation);

    if (engagementOrgId !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get reporting period emissions data
    const detector = new DataGapDetector();

    // If framework is specified, detect gaps for that framework
    if (engagement.framework) {
      const emissionsData = {
        scope1: undefined,
        scope2: undefined,
        scope3: undefined,
      };

      const gaps = await detector.detectGaps(
        engagement.framework,
        emissionsData,
        engagement.scope
      );

      const coverage = detector.calculateCoverage(
        engagement.framework,
        emissionsData,
        engagement.scope
      );

      return NextResponse.json({
        engagementId: id,
        framework: engagement.framework,
        gaps,
        coverage: Math.round(coverage),
        storedGaps: engagement.dataGaps || [],
      });
    }

    return NextResponse.json({
      engagementId: id,
      gaps: engagement.dataGaps || [],
      coverage: 0,
    });
  } catch (error) {
    console.error("Error fetching data gaps:", error);
    return NextResponse.json(
      { error: "Failed to fetch data gaps" },
      { status: 500 }
    );
  }
}
