import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import type {
  ComplianceTarget,
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

function asComplianceTargets(
  docs: Array<{
    id: string;
    framework: ESGFramework;
    metricKey: string;
    targetValue: number;
    baselineYear: number;
    targetYear: number;
    status: ComplianceTarget["status"];
  }>,
): ComplianceTarget[] {
  return docs.map((doc) => ({
    id: doc.id,
    framework: doc.framework,
    metricKey: doc.metricKey,
    targetValue: doc.targetValue,
    baselineYear: doc.baselineYear,
    targetYear: doc.targetYear,
    status: doc.status,
  }));
}

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ framework: string }> },
) => {
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

    const { framework } = await params;
    const { periodId } = Object.fromEntries(new URL(req.url).searchParams);

    if (!framework || !periodId) {
      return NextResponse.json(
        { error: "Missing required parameters: framework, periodId" },
        { status: 400 },
      );
    }

    const validFrameworks: ESGFramework[] = ["csrd", "brsr", "gri", "sasb"];
    if (!validFrameworks.includes(framework as ESGFramework)) {
      return NextResponse.json(
        { error: `Invalid framework: ${framework}` },
        { status: 400 },
      );
    }

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

    if (!mapping.docs || mapping.docs.length === 0) {
      return NextResponse.json(
        { error: "No mapping found for this framework and period" },
        { status: 404 },
      );
    }

    const latestMapping = mapping.docs[0];
    const metrics = asMetricValues(latestMapping.metrics);

    const targets = await payload.find({
      collection: "compliance-targets",
      where: {
        and: [
          { framework: { equals: framework } },
          { organisation: { equals: ctx.activeOrg.id } },
        ],
      },
      overrideAccess: true,
    });

    const report = await reportGenerator.generateFrameworkReport(
      framework as ESGFramework,
      metrics,
      asComplianceTargets(targets.docs),
    );

    const score = await complianceChecker.getComplianceScore(
      framework as ESGFramework,
      metrics,
    );
    const statement = await reportGenerator.generateComplianceStatement(
      framework as ESGFramework,
      score,
    );

    return NextResponse.json({
      success: true,
      framework,
      periodId,
      report: {
        generatedAt: report.generatedAt,
        metrics: report.metrics,
        complianceScore: report.complianceScore,
        targets: report.targets,
        trajectory: report.trajectory,
        dataGaps: report.dataGaps,
        checklist: report.checklist,
      },
      statement: {
        statement: statement.statement,
        score: statement.score,
        status: statement.status,
        nextSteps: statement.nextSteps,
      },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
};
