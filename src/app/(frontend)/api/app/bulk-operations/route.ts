import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import {
  captureBeforeSnapshot,
  executeBulkMutation,
  resolveClientSnapshot,
} from "@/lib/bulk/execute";
import { operationSupportsUndo } from "@/lib/bulk/snapshot";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const where: Where[] = [{ organisation: { equals: ctx.activeOrg.id } }];

  if (status) {
    where.push({ status: { equals: status } });
  }

  const payload = await getPayload({ config });
  const ops = await payload.find({
    collection: "bulk-operations",
    where: { and: where },
    sort: "-createdAt",
    limit: 100,
    depth: 2,
  });

  return NextResponse.json({
    operations: ops.docs.map((op) => ({
      id: op.id,
      operationType: op.operationType,
      resourceType: op.resourceType,
      itemCount: op.itemCount,
      status: op.status,
      progressPercent: op.progressPercent,
      actor:
        typeof op.actor === "object" && op.actor && "email" in op.actor
          ? { id: op.actor.id, email: op.actor.email }
          : null,
      createdAt: op.createdAt,
      canUndo: Boolean(op.canUndo) && !op.undoneAt,
      canRedo: Boolean(op.canRedo) && Boolean(op.undoneAt) && !op.redoneAt,
      undoneAt: op.undoneAt ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  if (!can(ctx.activeOrg.plan, "bulk_actions")) {
    return NextResponse.json(
      billingDeniedResponse(
        new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "bulk_actions"),
      ),
      { status: 402 },
    );
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "bulk-operations",
    ctx.activeOrg.id,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { operationType, resourceType, itemIds, changes, beforeSnapshot } = body;

  if (!operationType || !resourceType || !itemIds || !Array.isArray(itemIds)) {
    return NextResponse.json(
      {
        error: "Missing required fields: operationType, resourceType, itemIds (array)",
      },
      { status: 400 },
    );
  }

  if (itemIds.length === 0) {
    return NextResponse.json({ error: "itemIds array cannot be empty" }, { status: 400 });
  }

  const ids = itemIds.map((id: unknown) => String(id));
  const payload = await getPayload({ config });

  try {
    const serverSnapshot = await captureBeforeSnapshot(
      payload,
      resourceType,
      ids,
      ctx.activeOrg.id,
    );
    const resolvedBefore = resolveClientSnapshot(beforeSnapshot, serverSnapshot);

    if (operationSupportsUndo(operationType) && resolvedBefore.length === 0) {
      return NextResponse.json(
        { error: "Could not capture beforeSnapshot for selected items" },
        { status: 400 },
      );
    }

    const mutation = await executeBulkMutation(payload, {
      operationType,
      resourceType,
      itemIds: ids,
      organisationId: ctx.activeOrg.id,
      changes,
      beforeSnapshot: resolvedBefore,
    });

    const supportsUndo =
      operationSupportsUndo(operationType) && resolvedBefore.length > 0;
    const failed = Boolean(mutation.errorMessage);

    const bulkOp = await payload.create({
      collection: "bulk-operations",
      data: {
        organisation: ctx.activeOrg.id,
        actor: ctx.user.id,
        operationType,
        resourceType,
        itemIds: ids,
        itemCount: ids.length,
        changes,
        beforeSnapshot: resolvedBefore,
        afterSnapshot: mutation.afterSnapshot,
        status: failed ? "failed" : "completed",
        progressPercent: failed ? 0 : 100,
        errorMessage: mutation.errorMessage ?? undefined,
        canUndo: supportsUndo && !failed,
        canRedo: false,
      },
    });

    if (failed) {
      return NextResponse.json(
        { error: mutation.errorMessage, operation: bulkOp },
        { status: 500 },
      );
    }

    return NextResponse.json({ operation: bulkOp }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create bulk operation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
