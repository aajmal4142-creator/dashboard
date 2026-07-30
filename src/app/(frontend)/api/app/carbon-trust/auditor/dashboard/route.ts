import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export async function GET() {
  const auth = await getCurrentContext();

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });

  try {
    // Get certifications assigned to this auditor
    const certifications = await payload.find({
      collection: "carbon-trust-certifications",
      where: {
        and: [
          {
            or: [
              { "auditor.userId": { equals: auth.user.id } },
              { status: { equals: "submitted" } },
            ],
          },
        ],
      },
      limit: 100,
      sort: "-createdAt",
    });

    const details = await Promise.all(
      certifications.docs.map(async (cert) => {
        const items = await payload.find({
          collection: "carbon-trust-checklist-items",
          where: { certification: { equals: cert.id } },
          limit: 1000,
        });

        return {
          id: cert.id,
          certificationId: cert.certificationId,
          organisation: (cert.organisation as { name?: string }).name || "Unknown",
          status: cert.status,
          completionPercentage: cert.completionPercentage,
          submittedAt: cert.submittedAt,
          auditor: cert.auditor,
          itemSummary: {
            total: items.totalDocs,
            approved: items.docs.filter((i) => i.status === "approved").length,
            pending: items.docs.filter((i) => i.status === "additional_info_requested")
              .length,
            notStarted: items.docs.filter((i) => i.status === "not_started").length,
          },
        };
      }),
    );

    // Group by status
    const grouped = {
      submitted: details.filter((d) => d.status === "submitted"),
      underReview: details.filter((d) => d.status === "under_review"),
      requestingInfo: details.filter((d) => d.status === "additional_info_requested"),
      approved: details.filter((d) => d.status === "approved"),
      rejected: details.filter((d) => d.status === "rejected"),
      certified: details.filter((d) => d.status === "certified"),
    };

    return NextResponse.json({
      certifications: details,
      grouped,
      summary: {
        total: details.length,
        submitted: grouped.submitted.length,
        underReview: grouped.underReview.length,
        requestingInfo: grouped.requestingInfo.length,
        approved: grouped.approved.length,
        rejected: grouped.rejected.length,
        certified: grouped.certified.length,
      },
    });
  } catch (error) {
    console.error("Error fetching auditor dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
}
