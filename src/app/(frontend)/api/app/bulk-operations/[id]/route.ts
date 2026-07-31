import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  buildRedoPreview,
  buildUndoPreview,
  parseBulkSnapshot,
} from "@/lib/bulk/snapshot";
import config from "@/payload.config";

function isOpActor(
  actor: string | { id: string } | null | undefined,
  userId: string,
): boolean {
  if (!actor) return false;
  if (typeof actor === "string") return actor === userId;
  return actor.id === userId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });
  const op = await payload.findByID({
    collection: "bulk-operations",
    id,
    depth: 2,
  });

  if (!op) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  const orgId =
    typeof op.organisation === "object" && op.organisation
      ? op.organisation.id
      : op.organisation;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isOpActor(op.actor, ctx.user.id) && ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const beforeSnapshot = parseBulkSnapshot(op.beforeSnapshot);
  const afterSnapshot = parseBulkSnapshot(op.afterSnapshot);
  const canUndo = Boolean(op.canUndo) && !op.undoneAt;
  const canRedo = Boolean(op.canRedo) && Boolean(op.undoneAt) && !op.redoneAt;

  return NextResponse.json({
    operation: {
      id: op.id,
      operationType: op.operationType,
      resourceType: op.resourceType,
      itemCount: op.itemCount,
      status: op.status,
      progressPercent: op.progressPercent,
      errorMessage: op.errorMessage,
      createdAt: op.createdAt,
      canUndo,
      canRedo,
      undoneAt: op.undoneAt ?? null,
      redoneAt: op.redoneAt ?? null,
      undoPreview: buildUndoPreview({
        operationType: op.operationType,
        resourceType: op.resourceType,
        beforeSnapshot,
        afterSnapshot,
        canUndo: Boolean(op.canUndo),
        undoneAt: op.undoneAt,
      }),
      redoPreview: buildRedoPreview({
        operationType: op.operationType,
        resourceType: op.resourceType,
        beforeSnapshot,
        afterSnapshot,
        canRedo,
      }),
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const payload = await getPayload({ config });

  const op = await payload.findByID({
    collection: "bulk-operations",
    id,
  });

  if (!op) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  const orgId =
    typeof op.organisation === "object" && op.organisation
      ? op.organisation.id
      : op.organisation;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isOpActor(op.actor, ctx.user.id) && ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updated = await payload.update({
      collection: "bulk-operations",
      id,
      data: body,
    });

    return NextResponse.json({ operation: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update operation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
