import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import { FindingsSeverityScorer, AssuranceScorer } from "@/lib/assurance";
import type { DataGap, VerificationFinding } from "@/lib/assurance";
import config from "@/payload.config";

function toLibFindings(
  docs: Array<{
    id: string;
    engagement: string | { id: string };
    category: VerificationFinding["category"];
    severity: VerificationFinding["severity"];
    title: string;
    description: string;
    affectedMetric?: string | null;
    impact?: VerificationFinding["impact"] | null;
    recommendation?: string | null;
    status: VerificationFinding["status"];
    submittedBy: string | { id: string };
    submittedAt: string;
  }>,
): VerificationFinding[] {
  return docs.map((doc) => ({
    id: doc.id,
    engagement: typeof doc.engagement === "object" ? doc.engagement.id : doc.engagement,
    category: doc.category,
    severity: doc.severity,
    title: doc.title,
    description: doc.description,
    affectedMetric: doc.affectedMetric ?? undefined,
    impact: doc.impact ?? undefined,
    recommendation: doc.recommendation ?? undefined,
    status: doc.status,
    submittedBy:
      typeof doc.submittedBy === "object" ? doc.submittedBy.id : doc.submittedBy,
    submittedAt: new Date(doc.submittedAt),
  }));
}

function toLibGaps(value: unknown): DataGap[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const gap = item as Record<string, unknown>;
    if (typeof gap.metric !== "string" || typeof gap.description !== "string") {
      return [];
    }
    return [
      {
        metric: gap.metric,
        severity:
          gap.severity === "high" || gap.severity === "medium" || gap.severity === "low"
            ? gap.severity
            : "medium",
        description: gap.description,
        framework: typeof gap.framework === "string" ? gap.framework : undefined,
        affectedScope:
          gap.affectedScope === "scope1" ||
          gap.affectedScope === "scope2" ||
          gap.affectedScope === "scope3"
            ? gap.affectedScope
            : undefined,
      },
    ];
  });
}

export async function POST(req: Request) {
  const auth = await getCurrentContext();

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { engagementId: string };

    if (!body.engagementId) {
      return NextResponse.json({ error: "engagementId is required" }, { status: 400 });
    }

    const payload = await getPayload({ config });

    // Verify engagement exists
    const engagement = await payload.findByID({
      collection: "assurance-engagements",
      id: body.engagementId,
      overrideAccess: true,
    });

    const engagementOrgId =
      typeof engagement.organisation === "object"
        ? engagement.organisation.id
        : String(engagement.organisation);

    if (engagementOrgId !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch all findings for this engagement
    const findingsResult = await payload.find({
      collection: "verification-findings",
      where: {
        engagement: {
          equals: body.engagementId,
        },
      },
      limit: 1000,
    });

    // Calculate severity summary
    const findings = toLibFindings(findingsResult.docs);
    const dataGaps = toLibGaps(engagement.dataGaps);

    const severityScorer = new FindingsSeverityScorer();
    const severity = severityScorer.aggregateSeverity(findings);

    // Calculate assurance score
    const assuranceScorer = new AssuranceScorer();
    const assuranceScore = assuranceScorer.calculateAssuranceScore(
      findings,
      dataGaps,
      75, // Mock coverage percentage
    );

    const assuranceLevel = assuranceScorer.determineAssuranceLevel(assuranceScore);

    // Create draft assurance report
    const report = await payload.create({
      collection: "assurance-reports",
      data: {
        engagement: body.engagementId,
        organisation: engagement.organisation,
        reportingPeriod: engagement.reportingPeriod,
        status: "draft",
        assuranceLevel,
        assuranceStatement: `Based on our engagement with ${engagement.provider.name}, we provide ${assuranceLevel} assurance over the reported emissions data for the ${engagement.scope} scope(s).`,
        executiveSummary: `This report summarizes our ${assuranceLevel} assurance engagement covering ${engagement.scope} emissions. We identified ${severity.criticalCount + severity.majorCount + severity.minorCount + severity.infoCount} findings across the scope of our review.`,
        findingsSummary: {
          total:
            severity.criticalCount +
            severity.majorCount +
            severity.minorCount +
            severity.infoCount,
          critical: severity.criticalCount,
          major: severity.majorCount,
          minor: severity.minorCount,
          info: severity.infoCount,
        },
        provider: {
          name: engagement.provider.name,
          credentials: engagement.provider.providerOrg,
          signatureDate: new Date().toISOString(),
          signatureName: engagement.provider.contactPerson || "Provider Rep",
        },
        generatedAt: new Date().toISOString(),
        dataGapsSummary: engagement.dataGaps || [],
        assuranceScore,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

export async function GET() {
  const auth = await getCurrentContext();

  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });

    const reports = await payload.find({
      collection: "assurance-reports",
      where: {
        organisation: {
          equals: auth.activeOrg.id,
        },
      },
      limit: 100,
      sort: "-generatedAt",
    });

    return NextResponse.json({
      reports: reports.docs,
      total: reports.totalDocs,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
