import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import type { ESGFramework, FrameworkMetricValue } from "@/lib/frameworks/types";
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

function asEmissionsData(value: unknown): {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { scope1: 0, scope2: 0, scope3: 0, total: 0 };
  }
  const data = value as Record<string, unknown>;
  return {
    scope1: typeof data.scope1 === "number" ? data.scope1 : 0,
    scope2: typeof data.scope2 === "number" ? data.scope2 : 0,
    scope3: typeof data.scope3 === "number" ? data.scope3 : 0,
    total: typeof data.total === "number" ? data.total : 0,
  };
}

export const POST = async (req: NextRequest) => {
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

    const body = (await req.json()) as {
      framework?: ESGFramework;
      periodId?: string;
    };
    const { framework, periodId } = body;

    if (!framework || !periodId) {
      return NextResponse.json(
        { error: "Missing required fields: framework, periodId" },
        { status: 400 },
      );
    }

    const validFrameworks: ESGFramework[] = ["csrd", "brsr", "gri", "sasb"];
    if (!validFrameworks.includes(framework)) {
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
    const emissionsData = asEmissionsData(latestMapping.emissionsData);

    const audit = await complianceChecker.auditFramework(
      framework,
      emissionsData,
      metrics,
    );

    const score = await complianceChecker.getComplianceScore(framework, metrics);
    const checklist = await complianceChecker.getComplianceChecklist(framework);

    return NextResponse.json({
      success: true,
      framework,
      periodId,
      audit: {
        missingMetrics: audit.missingMetrics,
        dataGaps: audit.dataGaps,
        anomalies: audit.anomalies,
        confidenceLevel: audit.confidenceLevel,
      },
      complianceScore: {
        score: score.score,
        status: score.status,
        metricsProvided: score.metricsProvided,
        metricsRequired: score.metricsRequired,
      },
      checklist: checklist.map((item) => ({
        id: item.id,
        category: item.category,
        task: item.task,
        required: item.required,
        priority: item.priority,
        estimatedEffort: item.estimatedEffort,
      })),
    });
  } catch (error) {
    console.error("Compliance audit error:", error);
    return NextResponse.json({ error: "Failed to audit compliance" }, { status: 500 });
  }
};
