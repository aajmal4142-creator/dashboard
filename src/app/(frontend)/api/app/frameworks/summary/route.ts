import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import type {
  ComplianceScore,
  ESGFramework,
  FrameworkMetricValue,
} from "@/lib/frameworks/types";
import { reportGenerator } from "@/lib/frameworks/reportGenerator";
import { complianceChecker } from "@/lib/frameworks/complianceChecker";

function asMetricValues(value: unknown): FrameworkMetricValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.metricKey !== "string" ||
      typeof row.value !== "number" ||
      typeof row.unit !== "string"
    ) {
      return [];
    }
    return [
      {
        metricKey: row.metricKey,
        value: row.value,
        unit: row.unit,
        confidence:
          row.confidence === "high" ||
          row.confidence === "medium" ||
          row.confidence === "low"
            ? row.confidence
            : "medium",
        calculatedAt:
          typeof row.calculatedAt === "string" || row.calculatedAt instanceof Date
            ? new Date(row.calculatedAt)
            : new Date(),
      },
    ];
  });
}

export const GET = async (req: NextRequest) => {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const payload = await getPayload({ config });

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { periodId } = Object.fromEntries(new URL(req.url).searchParams);

    if (!periodId) {
      return NextResponse.json(
        { error: "Missing required parameter: periodId" },
        { status: 400 },
      );
    }

    const frameworks: ESGFramework[] = ["csrd", "brsr", "gri", "sasb"];
    const metricsMap: Record<ESGFramework, FrameworkMetricValue[]> = {
      csrd: [],
      brsr: [],
      gri: [],
      sasb: [],
    };

    for (const framework of frameworks) {
      const mapping = await payload.find({
        collection: "framework-mappings",
        where: {
          and: [
            { framework: { equals: framework } },
            { period: { equals: periodId } },
            { organisation: { equals: ctx.activeOrg.id } },
          ],
        },
        limit: 1,
        sort: "-calculatedAt",
        overrideAccess: true,
      });

      if (mapping.docs && mapping.docs.length > 0) {
        metricsMap[framework] = asMetricValues(mapping.docs[0].metrics);
      }
    }

    const summary = await reportGenerator.generateMultiFrameworkSummary(
      frameworks,
      metricsMap,
    );

    const frameworkScores = {} as Record<
      ESGFramework,
      Pick<ComplianceScore, "score" | "status" | "metricsProvided" | "metricsRequired">
    >;
    for (const framework of frameworks) {
      const score = await complianceChecker.getComplianceScore(
        framework,
        metricsMap[framework],
      );
      frameworkScores[framework] = {
        score: score.score,
        status: score.status,
        metricsProvided: score.metricsProvided,
        metricsRequired: score.metricsRequired,
      };
    }

    return NextResponse.json({
      success: true,
      periodId,
      overallCompliance: summary.overallCompliance,
      generatedAt: summary.generatedAt,
      frameworks: frameworkScores,
      highlights: summary.highlights,
      recommendations: summary.recommendations,
    });
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
};
