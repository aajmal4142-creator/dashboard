import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { createAuditorWorkflow } from "@/lib/carbon-trust/auditorWorkflow";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentContext();
  const { id } = await params;

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });

  try {
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
    });

    if (!cert || (cert.organisation as { id: string }).id !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const items = await payload.find({
      collection: "carbon-trust-checklist-items",
      where: { certification: { equals: id } },
      limit: 1000,
    });

    const trail = await payload.find({
      collection: "carbon-trust-audit-trail",
      where: { certification: { equals: id } },
      sort: "-createdAt",
      limit: 50,
    });

    return NextResponse.json({
      certification: cert,
      checklistItems: items.docs,
      auditTrail: trail.docs,
      summary: {
        total: items.totalDocs,
        approved: items.docs.filter((i) => i.status === "approved").length,
        pending: items.docs.filter((i) => i.status === "additional_info_requested")
          .length,
        notStarted: items.docs.filter((i) => i.status === "not_started").length,
      },
    });
  } catch (error) {
    console.error("Error fetching certification for audit:", error);
    return NextResponse.json({ error: "Failed to fetch certification" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentContext();
  const { id } = await params;

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action: string;
    itemId?: string;
    itemIds?: string[];
    feedback?: string;
    reason?: string;
    reviewNotes?: string;
  };

  const payload = await getPayload({ config });

  try {
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
    });

    if (!cert || (cert.organisation as { id: string }).id !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workflow = createAuditorWorkflow(payload);

    switch (body.action) {
      case "approve-item": {
        if (!body.itemId) {
          return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
        }

        await workflow.reviewChecklistItem(
          body.itemId,
          id,
          auth.activeOrg.id,
          auth.user.id,
          body.feedback || "Approved by auditor",
          true,
        );

        return NextResponse.json({
          message: "Item approved",
          action: "item_approved",
        });
      }

      case "reject-item": {
        if (!body.itemId) {
          return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
        }

        await workflow.reviewChecklistItem(
          body.itemId,
          id,
          auth.activeOrg.id,
          auth.user.id,
          body.reason || "Additional information needed",
          false,
        );

        return NextResponse.json({
          message: "Item flagged for additional info",
          action: "item_flagged",
        });
      }

      case "request-info": {
        if (!body.itemId) {
          return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
        }

        await workflow.requestAdditionalInfo(
          body.itemId,
          id,
          auth.activeOrg.id,
          auth.user.id,
          body.reason || "Additional information required",
        );

        return NextResponse.json({
          message: "Information request sent",
          action: "info_requested",
        });
      }

      case "batch-approve": {
        if (!body.itemIds || !Array.isArray(body.itemIds)) {
          return NextResponse.json({ error: "Missing itemIds array" }, { status: 400 });
        }

        await workflow.batchApproveItems(
          id,
          body.itemIds,
          auth.activeOrg.id,
          auth.user.id,
        );

        return NextResponse.json({
          message: `Batch approved ${body.itemIds.length} items`,
          action: "batch_approved",
        });
      }

      case "approve-certification": {
        await workflow.approveCertification(
          id,
          auth.activeOrg.id,
          auth.user.id,
          body.reviewNotes,
        );

        return NextResponse.json({
          message: "Certification approved",
          action: "certification_approved",
        });
      }

      case "reject-certification": {
        if (!body.reason) {
          return NextResponse.json(
            { error: "Missing rejection reason" },
            { status: 400 },
          );
        }

        await workflow.rejectCertification(
          id,
          auth.activeOrg.id,
          auth.user.id,
          body.reason,
        );

        return NextResponse.json({
          message: "Certification rejected",
          action: "certification_rejected",
        });
      }

      case "finalize": {
        const certificateNumber = await workflow.finalizeCertification(
          id,
          auth.activeOrg.id,
          auth.user.id,
        );

        return NextResponse.json({
          message: "Certificate finalized",
          certificateNumber,
          action: "certified",
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in auditor action:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process auditor action",
      },
      { status: 500 },
    );
  }
}
