import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { buildOpinionLetterDraft } from "@/lib/assurance";
import { isAssuranceLevel } from "@/lib/assurance/pathways";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function orgIdOf(organisation: string | { id: string }): string {
  return typeof organisation === "object" ? organisation.id : String(organisation);
}

type DataGapRow = {
  metric?: string | null;
  severity?: string | null;
  description?: string | null;
};

/**
 * GET /api/app/assurance/engagements/[id]/opinion-draft
 * Renders a plain-text limited/reasonable opinion letter DRAFT from engagement
 * metadata. Not a signed opinion — the provider must review and issue it.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const auth = await getCurrentContext();
    if (!auth.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const payload = await getPayload({ config });
    const engagement = await payload
      .findByID({
        collection: "assurance-engagements",
        id,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);

    if (!engagement || orgIdOf(engagement.organisation) !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const periodId =
      typeof engagement.reportingPeriod === "object"
        ? engagement.reportingPeriod.id
        : String(engagement.reportingPeriod);
    const period = await payload
      .findByID({
        collection: "reporting-periods",
        id: periodId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);

    const level = isAssuranceLevel(engagement.assuranceLevel)
      ? engagement.assuranceLevel
      : "limited";

    const dataGaps = (engagement.dataGaps ?? []) as DataGapRow[];
    const gapLines = dataGaps.map(
      (g) =>
        `- [${g.severity ?? "unknown"}] ${g.metric ?? "unlabelled"}: ${g.description ?? ""}`,
    );
    const findingsSummary = [
      engagement.notes?.trim() || null,
      gapLines.length > 0 ? `Data gaps identified:\n${gapLines.join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const text = buildOpinionLetterDraft({
      level,
      organisationName: auth.activeOrg.name,
      periodLabel:
        typeof period?.label === "string" && period.label ? period.label : periodId,
      materialityThresholdTco2e:
        typeof engagement.materialityThresholdTco2e === "number"
          ? engagement.materialityThresholdTco2e
          : null,
      samplingPlan: {
        method:
          typeof engagement.samplingMethod === "string"
            ? engagement.samplingMethod
            : null,
        populationSize:
          typeof engagement.samplingPopulationSize === "number"
            ? engagement.samplingPopulationSize
            : null,
        sampleSize:
          typeof engagement.samplingSampleSize === "number"
            ? engagement.samplingSampleSize
            : null,
        notes:
          typeof engagement.samplingNotes === "string" ? engagement.samplingNotes : null,
      },
      findingsSummary: findingsSummary || null,
    });

    return NextResponse.json({ text });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Opinion draft error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
