import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

interface UpdateRequest {
  status?: string;
  response?: string;
  attachedDocuments?: string[];
  notes?: string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await getCurrentContext();
  const { id, itemId } = await params;

  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as UpdateRequest;
    const payload = await getPayload({ config });

    // Verify certification belongs to user's org
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
    });

    if (!cert || (cert.organisation as { id: string }).id !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    // Get checklist item
    const item = await payload.findByID({
      collection: "carbon-trust-checklist-items",
      id: itemId,
    });

    if (!item || (item.certification as { id: string }).id !== id) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    // Validate status if provided
    const validStatuses = [
      "not_started",
      "in_progress",
      "submitted",
      "additional_info_requested",
      "approved",
      "not_applicable",
    ];

    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Update checklist item
    const updateData: Record<string, unknown> = {};

    if (body.status) updateData.status = body.status;
    if (body.response) updateData.response = body.response;
    if (body.attachedDocuments) updateData.attachedDocuments = body.attachedDocuments;
    if (body.notes) updateData.notes = body.notes;

    const updatedItem = await payload.update({
      collection: "carbon-trust-checklist-items",
      id: itemId,
      data: updateData,
    });

    // Recalculate certification completion percentage
    const allItems = await payload.find({
      collection: "carbon-trust-checklist-items",
      where: {
        certification: { equals: id },
      },
      limit: 1000,
    });

    const completed = allItems.docs.filter(
      (i) => i.status === "approved" || i.status === "not_applicable",
    ).length;

    const completionPercentage = Math.round((completed / allItems.docs.length) * 100);

    await payload.update({
      collection: "carbon-trust-certifications",
      id,
      data: { completionPercentage },
    });

    return NextResponse.json({ item: updatedItem, completionPercentage });
  } catch (error) {
    console.error("Error updating checklist item:", error);
    return NextResponse.json(
      { error: "Failed to update checklist item" },
      { status: 500 },
    );
  }
}
