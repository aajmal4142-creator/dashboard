import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

const DSR_STATUSES = ["open", "in_progress", "fulfilled", "rejected"] as const;
type DsrStatus = (typeof DSR_STATUSES)[number];

function isDsrStatus(value: unknown): value is DsrStatus {
  return typeof value === "string" && (DSR_STATUSES as readonly string[]).includes(value);
}

type UpdateDsrBody = {
  status?: string;
  notes?: string;
  dueAt?: string | null;
};

/**
 * PATCH /api/app/privacy/dsr/[id] — update notes / due date, or transition
 * status. Marking a request fulfilled or rejected requires owner/admin.
 */
export async function PATCH(req: Request, routeCtx: RouteCtx) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Contributor role or above is required" },
      { status: 403 },
    );
  }

  const { id } = await routeCtx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "data-subject-requests",
    id,
    depth: 0,
    overrideAccess: true,
  });

  const orgId =
    typeof existing.organisation === "object" && existing.organisation !== null
      ? existing.organisation.id
      : existing.organisation;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as UpdateDsrBody;

  const data: {
    notes?: string;
    dueAt?: string | null;
    status?: DsrStatus;
    fulfilledAt?: string;
    fulfilledBy?: string;
  } = {};

  if (body.notes !== undefined) data.notes = body.notes;
  if (body.dueAt !== undefined) data.dueAt = body.dueAt;

  if (body.status !== undefined) {
    if (!isDsrStatus(body.status)) {
      return NextResponse.json(
        { error: "status must be open, in_progress, fulfilled, or rejected" },
        { status: 400 },
      );
    }
    const isFulfillTransition = body.status === "fulfilled" || body.status === "rejected";
    if (isFulfillTransition && ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Owner or admin required to mark a request fulfilled or rejected" },
        { status: 403 },
      );
    }
    data.status = body.status;
    if (body.status === "fulfilled") {
      data.fulfilledAt = new Date().toISOString();
      data.fulfilledBy = ctx.user.id;
    }
  }

  const updated = await payload.update({
    collection: "data-subject-requests",
    id,
    data,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "privacy.dsr_updated",
    entityType: "data-subject-requests",
    entityId: id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return NextResponse.json({
    ok: true,
    request: {
      id: updated.id,
      type: updated.type,
      requesterEmail: updated.requesterEmail,
      status: updated.status,
      notes: updated.notes ?? null,
      dueAt: updated.dueAt ?? null,
      fulfilledAt: updated.fulfilledAt ?? null,
    },
  });
}
