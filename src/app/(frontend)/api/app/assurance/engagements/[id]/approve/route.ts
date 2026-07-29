import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      approvalNotes?: string;
    };

    const payload = await getPayload({ config });

    // Verify engagement exists
    const engagement = await payload.findByID({
      collection: "assurance-engagements",
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

    // Only approve if findings have been submitted
    if (engagement.status !== "findings_submitted") {
      return NextResponse.json(
        { error: "Engagement must have findings submitted before approval" },
        { status: 400 },
      );
    }

    // Update engagement to approved status
    const updated = await payload.update({
      collection: "assurance-engagements",
      id,
      data: {
        status: "approved",
        approvedAt: new Date().toISOString(),
        notes: body.approvalNotes || engagement.notes,
      },
    });

    return NextResponse.json({ engagement: updated });
  } catch (error) {
    console.error("Error approving engagement:", error);
    return NextResponse.json({ error: "Failed to approve engagement" }, { status: 500 });
  }
}
