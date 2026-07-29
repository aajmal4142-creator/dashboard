import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
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
      canUndo: op.canUndo && !op.undoneAt,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
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

  const payload = await getPayload({ config });

  try {
    const bulkOp = await payload.create({
      collection: "bulk-operations",
      data: {
        organisation: ctx.activeOrg.id,
        actor: ctx.user.id,
        operationType,
        resourceType,
        itemIds,
        itemCount: itemIds.length,
        changes,
        beforeSnapshot,
        status: "pending",
        progressPercent: 0,
        canUndo: true,
      },
    });

    return NextResponse.json({ operation: bulkOp }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create bulk operation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
