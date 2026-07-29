import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import { FindingsSeverityScorer, AssuranceScorer } from "@/lib/assurance";
import config from "@/payload.config";

export async function POST(req: Request) {
  const auth = await getCurrentContext();

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { engagementId: string };

    if (!body.engagementId) {
      return NextResponse.json(
        { error: "engagementId is required" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    // Verify engagement exists
    const engagement = await payload.findByID({
      collection: "assurance-engagements" as any,
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
      collection: "verification-findings" as any,
      where: {
        engagement: {
          equals: body.engagementId,
        },
      },
      limit: 1000,
    });

    // Calculate severity summary
    const severityScorer = new FindingsSeverityScorer();
    const severity = severityScorer.aggregateSeverity(findingsResult.docs);

    // Calculate assurance score
    const assuranceScorer = new AssuranceScorer();
    const assuranceScore = assuranceScorer.calculateAssuranceScore(
      findingsResult.docs,
      engagement.dataGaps || [],
      75 // Mock coverage percentage
    );

    const assuranceLevel = assuranceScorer.determineAssuranceLevel(
      assuranceScore
    );

    // Create draft assurance report
    const report = await payload.create({
      collection: "assurance-reports" as any,
      data: {
        engagement: body.engagementId,
        organisation: engagement.organisation,
        reportingPeriod: engagement.reportingPeriod,
        status: "draft",
        assuranceLevel,
        assuranceStatement: `Based on our engagement with ${engagement.provider.name}, we provide ${assuranceLevel} assurance over the reported emissions data for the ${engagement.scope} scope(s).`,
        executiveSummary: `This report summarizes our ${assuranceLevel} assurance engagement covering ${engagement.scope} emissions. We identified ${severity.criticalCount + severity.majorCount + severity.minorCount + severity.infoCount} findings across the scope of our review.`,
        findingsSummary: {
          total: severity.criticalCount + severity.majorCount + severity.minorCount + severity.infoCount,
          critical: severity.criticalCount,
          major: severity.majorCount,
          minor: severity.minorCount,
          info: severity.infoCount,
        },
        provider: {
          name: engagement.provider.name,
          credentials: engagement.provider.providerOrg,
          signatureDate: new Date(),
          signatureName: engagement.provider.contactPerson || "Provider Rep",
        },
        generatedAt: new Date(),
        dataGapsSummary: engagement.dataGaps || [],
        assuranceScore,
      },
    });

    return NextResponse.json(
      { report },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
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
      collection: "assurance-reports" as any,
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
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
