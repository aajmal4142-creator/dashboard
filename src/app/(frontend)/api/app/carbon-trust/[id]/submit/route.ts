import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { createAuditorWorkflow } from "@/lib/carbon-trust/auditorWorkflow";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentContext();
  const { id } = await params;

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });

    // Verify certification belongs to user's org
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
    });

    if (!cert || (cert.organisation as { id: string }).id !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    if (cert.status !== "draft" && cert.status !== "additional_info_requested") {
      return NextResponse.json(
        { error: `Cannot submit certification in ${cert.status} status` },
        { status: 400 },
      );
    }

    // Check that critical items have responses
    const criticalItems = await payload.find({
      collection: "carbon-trust-checklist-items",
      where: {
        and: [
          { certification: { equals: id } },
          { severity: { equals: "critical" } },
          { status: { equals: "not_started" } },
        ],
      },
      limit: 1,
    });

    if (criticalItems.totalDocs > 0) {
      return NextResponse.json(
        { error: "All critical requirements must be addressed before submission" },
        { status: 400 },
      );
    }

    // Submit certification for review
    const workflow = createAuditorWorkflow(payload);
    await workflow.submitCertificationForReview(id, auth.activeOrg.id, auth.user.id);

    const updatedCert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
    });

    return NextResponse.json({
      message: "Certification submitted for review",
      certification: updatedCert,
    });
  } catch (error) {
    console.error("Error submitting certification:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit certification",
      },
      { status: 500 },
    );
  }
}
