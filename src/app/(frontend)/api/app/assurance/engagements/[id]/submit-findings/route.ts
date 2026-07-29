import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import type { VerificationFinding } from "@/lib/assurance";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      findings: Partial<VerificationFinding>[];
      summary?: string;
    };

    if (!body.findings || body.findings.length === 0) {
      return NextResponse.json(
        { error: "No findings provided" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    // Verify engagement exists and belongs to organization
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

    // Create findings in database
    const createdFindings = [];
    for (const finding of body.findings) {
      const created = await payload.create({
        collection: "verification-findings" as any,
        data: {
          engagement: id,
          category: finding.category || "other",
          severity: finding.severity || "info",
          title: finding.title || "Unnamed finding",
          description: finding.description || "",
          affectedMetric: finding.affectedMetric,
          evidence: finding.evidence,
          impact: finding.impact,
          recommendation: finding.recommendation,
          status: "open",
          submittedBy: auth.user.id,
          submittedAt: new Date(),
        },
      });
      createdFindings.push(created);
    }

    // Update engagement status
    const updatedEngagement = await payload.update({
      collection: "assurance-engagements" as any,
      id,
      data: {
        status: "findings_submitted",
      } as any,
    });

    return NextResponse.json(
      { engagement: updatedEngagement, findings: createdFindings },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting findings:", error);
    return NextResponse.json(
      { error: "Failed to submit findings" },
      { status: 500 }
    );
  }
}
