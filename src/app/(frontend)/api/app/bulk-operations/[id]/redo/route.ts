import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import { applySnapshotPlan, planRedoApply } from "@/lib/bulk/execute";
import {
  buildRedoPreview,
  deletedSnapshotItem,
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(ctx.activeOrg.plan, "bulk_actions")) {
    return NextResponse.json(
      billingDeniedResponse(
        new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "bulk_actions"),
      ),
      { status: 402 },
    );
  }

  const { id } = await params;
  const payload = await getPayload({ config });
  const op = await payload.findByID({
    collection: "bulk-operations",
    id,
    depth: 1,
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

  if (!op.canRedo || !op.undoneAt) {
    return NextResponse.json({ error: "Cannot redo this operation" }, { status: 400 });
  }

  const beforeSnapshot = parseBulkSnapshot(op.beforeSnapshot);
  const afterSnapshot = parseBulkSnapshot(op.afterSnapshot);

  if (!beforeSnapshot) {
    return NextResponse.json(
      { error: "No snapshot available for redo" },
      { status: 400 },
    );
  }

  if (op.operationType !== "delete" && !afterSnapshot) {
    return NextResponse.json(
      { error: "No afterSnapshot available for redo" },
      { status: 400 },
    );
  }

  const preview = buildRedoPreview({
    operationType: op.operationType,
    resourceType: op.resourceType,
    beforeSnapshot,
    afterSnapshot,
    canRedo: true,
  });

  try {
    const plan = planRedoApply(
      op.operationType,
      beforeSnapshot,
      afterSnapshot ?? beforeSnapshot.map((b) => deletedSnapshotItem(b.id, b.label)),
    );
    await applySnapshotPlan(payload, op.resourceType, plan);

    const redoRecord = await payload.update({
      collection: "bulk-operations",
      id,
      data: {
        canUndo: true,
        canRedo: false,
        undoneAt: null,
        redoneAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      message: "Bulk operation redone successfully",
      preview,
      operation: redoRecord,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to redo operation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
