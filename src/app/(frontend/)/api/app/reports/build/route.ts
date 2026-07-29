import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import { incrementReportUsage } from "@/lib/billing/freeTierGates";
import type { Report, ReportTemplate } from "@/payload-types";

type ReportFramework = Report["framework"];
type TemplateFramework = ReportTemplate["framework"];
type TemplateSection = NonNullable<ReportTemplate["sections"]>[number];
type TemplateVariable = NonNullable<ReportTemplate["variables"]>[number];

function mapReportFramework(value?: string): ReportFramework {
  const allowed: ReportFramework[] = [
    "CSRD_SET1",
    "CSRD_SIMPLIFIED",
    "BRSR",
    "VSME",
    "GRI",
    "CUSTOM",
  ];
  if (value && allowed.includes(value as ReportFramework)) {
    return value as ReportFramework;
  }
  const aliases: Record<string, ReportFramework> = {
    csrd: "CSRD_SET1",
    brsr: "BRSR",
    gri: "GRI",
    custom: "CUSTOM",
    vsme: "VSME",
  };
  return aliases[String(value || "").toLowerCase()] ?? "CUSTOM";
}

function mapTemplateFramework(value?: string): TemplateFramework {
  const allowed: TemplateFramework[] = ["csrd", "brsr", "gri", "sasb", "custom"];
  if (value && allowed.includes(value as TemplateFramework)) {
    return value as TemplateFramework;
  }
  return "custom";
}

/**
 * POST /api/app/reports/build
 * Create or update an interactive HTML report
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      reportName?: string;
      period?: string;
      sections?: TemplateSection[];
      framework?: string;
      variables?: TemplateVariable[];
    };
    const { reportName, period, sections, framework, variables } = body;

    if (!reportName) {
      return NextResponse.json({ error: "reportName is required" }, { status: 400 });
    }

    if (!period) {
      return NextResponse.json(
        { error: "period is required (reporting period id)" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    // Create report record
    const report = await payload.create({
      collection: "reports",
      data: {
        organisation: ctx.activeOrg.id,
        period,
        framework: mapReportFramework(framework),
        version: 1,
        status: "draft",
        snapshot: {
          reportName,
          sections: sections || [],
          variables: variables || [],
        },
      },
    });

    // Create template record for layout
    const template = await payload.create({
      collection: "report-templates",
      data: {
        organisation: ctx.activeOrg.id,
        templateName: `${reportName}_layout_${report.id}`,
        framework: mapTemplateFramework(framework),
        type: "html",
        sections: sections || [],
        variables: variables || [],
      },
    });

    // Track usage
    await incrementReportUsage(ctx.activeOrg.id);

    return NextResponse.json(
      {
        reportId: report.id,
        templateId: template.id,
        message: "Report created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error building report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/app/reports/templates
 * Get available report templates
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    // Get both public system templates and org-specific templates
    const templates = await payload.find({
      collection: "report-templates",
      where: {
        isPublic: { equals: true },
      },
      limit: 50,
    });

    return NextResponse.json({
      total: templates.totalDocs,
      templates: templates.docs.map((t) => ({
        id: t.id,
        name: t.templateName,
        framework: t.framework,
        type: t.type,
        description: t.description,
      })),
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
