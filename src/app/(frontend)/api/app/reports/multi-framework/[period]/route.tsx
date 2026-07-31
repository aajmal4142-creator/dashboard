import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getApiContext } from "@/lib/auth/apiContext";
import { can, resolveEffectivePlan } from "@/lib/billing";
import { requirePermission } from "@/lib/policy/protect";
import {
  buildMultiFrameworkReport,
  MultiFrameworkPdfDocument,
  resolveMultiFrameworkPeriod,
} from "@/lib/reports/multiFramework";
import config from "@/payload.config";

type Ctx = { params: Promise<{ period: string }> };

/**
 * GET /api/app/reports/multi-framework/[period]?format=json|pdf
 * Combines completed CSRD + TCFD + ISSB + GRI sections; skips incomplete.
 * Emissions totals appear once with cross-references.
 */
export async function GET(req: Request, ctxParams: Ctx) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { period: periodParam } = await ctxParams.params;
  if (!periodParam?.trim()) {
    return NextResponse.json(
      { error: "period path segment is required (year or reporting-period id)." },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  if (format !== "json" && format !== "pdf") {
    return NextResponse.json({ error: "format must be json or pdf." }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const resolved = await resolveMultiFrameworkPeriod(
    payload,
    ctx.activeOrg.id,
    periodParam,
  );
  if (!resolved) {
    return NextResponse.json(
      { error: "Reporting period not found for this organisation." },
      { status: 404 },
    );
  }

  try {
    const report = await buildMultiFrameworkReport(payload, {
      organisationId: ctx.activeOrg.id,
      organisationName: ctx.activeOrg.name,
      periodId: resolved.periodId,
      periodLabel: resolved.periodLabel,
      reportingYear: resolved.reportingYear,
    });

    if (format === "pdf") {
      if (report.sections.length === 0) {
        return NextResponse.json(
          {
            error:
              "No completed frameworks for this period. Finalise at least one of CSRD, TCFD, ISSB, or GRI materiality before exporting PDF.",
            skipped: report.executiveSummary.skippedFrameworks,
          },
          { status: 409 },
        );
      }

      const watermarked = !can(
        resolveEffectivePlan({
          plan: ctx.activeOrg.plan,
          subscriptionStatus: ctx.activeOrg.subscriptionStatus,
        }),
        "unwatermarked_pdf",
      );

      const buffer = await renderToBuffer(
        <MultiFrameworkPdfDocument report={report} watermarked={watermarked} />,
      );

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="clearesg-multi-framework-${resolved.reportingYear}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      organisationId: report.organisationId,
      organisationName: report.organisationName,
      periodId: report.periodId,
      periodLabel: report.periodLabel,
      reportingYear: report.reportingYear,
      generatedAt: report.generatedAt,
      emissionsOwner: report.emissionsOwner,
      emissions: report.emissions,
      executiveSummary: report.executiveSummary,
      sections: report.sections,
      frameworksIncluded: report.executiveSummary.includedFrameworks,
      frameworksSkipped: report.executiveSummary.skippedFrameworks,
      disclaimer: report.disclaimer,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Multi-framework report failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
