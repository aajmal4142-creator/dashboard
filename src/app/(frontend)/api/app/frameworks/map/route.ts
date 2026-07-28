import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import type { ESGFramework } from "@/lib/frameworks/types";
import { mappingEngine } from "@/lib/frameworks/mappingEngine";

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
      emissions?: {
        scope1?: number;
        scope2?: number;
        scope3?: number;
        total?: number;
      };
      revenue?: number;
      employees?: number;
      units?: number;
    };

    const { framework, periodId, emissions, revenue, employees, units } = body;

    if (!framework || !periodId || !emissions) {
      return NextResponse.json(
        { error: "Missing required fields: framework, periodId, emissions" },
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

    const metrics = await mappingEngine.mapEmissionsToFramework(
      {
        scope1: emissions.scope1 || 0,
        scope2: emissions.scope2 || 0,
        scope3: emissions.scope3 || 0,
        total: emissions.total || 0,
      },
      framework,
      { revenue, employees, units },
    );

    const complianceStatus = await mappingEngine.checkCompliance(framework, metrics);

    const mapping = await payload.create({
      collection: "framework-mappings",
      data: {
        organisation: ctx.activeOrg.id,
        period: periodId,
        framework,
        emissionsData: {
          scope1: emissions.scope1 || 0,
          scope2: emissions.scope2 || 0,
          scope3: emissions.scope3 || 0,
          total: emissions.total || 0,
        },
        metadata: { revenue, employees, units },
        metrics,
        complianceStatus: complianceStatus.status,
        calculatedAt: new Date().toISOString(),
        calculatedBy: ctx.user.id,
      },
      overrideAccess: true,
    });

    return NextResponse.json({
      success: true,
      framework,
      periodId,
      metrics,
      complianceStatus: {
        score: complianceStatus.score,
        status: complianceStatus.status,
        metricsProvided: complianceStatus.metricsProvided,
        metricsRequired: complianceStatus.metricsRequired,
      },
      mappingId: mapping.id,
    });
  } catch (error) {
    console.error("Framework mapping error:", error);
    return NextResponse.json(
      { error: "Failed to map emissions to framework" },
      { status: 500 },
    );
  }
};
