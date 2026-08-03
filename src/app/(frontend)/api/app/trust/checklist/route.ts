import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  computeChecklistProgress,
  isKnownControlId,
  isTrustControlStatus,
  resolveLatestStatuses,
  TRUST_CHECKLIST_CONTROLS,
} from "@/lib/trust";
import { loadTrustChecklistSnapshot } from "@/lib/trust/loadChecklist";
import { createTrustControlEvent, findTrustControlEvents } from "@/lib/trust/store";
import config from "@/payload.config";

/**
 * GET — Membership-gated checklist status for the active organisation.
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const snapshot = await loadTrustChecklistSnapshot(payload, ctx.activeOrg.id);

    return NextResponse.json({
      ...snapshot,
      canEdit: ctx.role === "owner" || ctx.role === "admin",
    });
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return NextResponse.json(
      { error: "Could not load trust checklist. Try again." },
      { status: 500 },
    );
  }
}

/**
 * POST — append a checklist status event (admin/owner). Append-only.
 * Body: { controlId, status, note? }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg || !ctx.user) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      controlId?: string;
      status?: string;
      note?: string | null;
    };

    const controlId = typeof body.controlId === "string" ? body.controlId.trim() : "";
    if (!controlId || !isKnownControlId(controlId)) {
      return NextResponse.json({ error: "Unknown controlId" }, { status: 400 });
    }
    if (!isTrustControlStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;

    const payload = await getPayload({ config });
    const created = await createTrustControlEvent(payload, {
      organisation: ctx.activeOrg.id,
      controlId,
      status: body.status,
      note,
      actor: ctx.user.id,
    });

    const listed = await findTrustControlEvents(payload, {
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 500,
      sort: "createdAt",
    });

    const events = listed.docs.map((d) => ({
      controlId: d.controlId,
      status: d.status,
      createdAt: d.createdAt,
    }));
    const items = resolveLatestStatuses(TRUST_CHECKLIST_CONTROLS, events);
    const progress = computeChecklistProgress(items);

    return NextResponse.json({
      event: {
        id: created.id,
        controlId: created.controlId,
        status: created.status,
        note: created.note ?? null,
        createdAt: created.createdAt,
      },
      items,
      progress,
    });
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return NextResponse.json(
      { error: "Could not append checklist event. Try again." },
      { status: 500 },
    );
  }
}
