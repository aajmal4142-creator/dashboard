import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import type { Iso14064ItemStatus } from "@/lib/compliance/iso14064Progress";
import { updateIso14064Item } from "@/lib/compliance/iso14064Service";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = {
  params: Promise<{ id: string; item_id: string }>;
};

function parseStatus(value: unknown): Iso14064ItemStatus | null {
  if (
    value === "not_started" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "na"
  ) {
    return value;
  }
  return null;
}

/**
 * PUT /api/app/compliance/iso-14064/[id]/items/[item_id]
 * Mark item complete / update status + attach evidence (required for complete).
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id, item_id: itemId } = await context.params;
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      status?: string;
      evidenceIds?: string[];
      evidence_id?: string;
      notes?: string | null;
    };

    let evidenceIds: string[] | undefined;
    if (Array.isArray(body.evidenceIds)) {
      evidenceIds = body.evidenceIds.filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
    } else if (typeof body.evidence_id === "string" && body.evidence_id) {
      evidenceIds = [body.evidence_id];
    }

    const status = body.status !== undefined ? parseStatus(body.status) : undefined;
    if (body.status !== undefined && !status) {
      return NextResponse.json(
        {
          error: "status must be not_started | in_progress | completed | na",
        },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    try {
      const checklist = await updateIso14064Item({
        payload,
        organisationId: ctx.activeOrg.id,
        checklistId: id,
        itemId,
        status: status ?? undefined,
        evidenceIds,
        notes: body.notes,
      });
      return NextResponse.json({ checklist, progress: checklist.progress });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      if (message.includes("evidence")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if (message.includes("not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      throw err;
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating ISO 14064 item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
