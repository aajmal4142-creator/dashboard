import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { CollectionSlug } from "payload";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export async function POST(
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
    depth: 1,
  });

  if (!op) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  const isInitiator =
    op.actor === ctx.user.id ||
    (typeof op.actor === "object" && op.actor && op.actor.id === ctx.user.id);
  if (!isInitiator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!op.canUndo || op.undoneAt) {
    return NextResponse.json({ error: "Cannot undo this operation" }, { status: 400 });
  }

  if (!op.beforeSnapshot || !Array.isArray(op.beforeSnapshot)) {
    return NextResponse.json(
      { error: "No snapshot available for undo" },
      { status: 400 },
    );
  }

  try {
    const beforeSnapshot = op.beforeSnapshot as Array<{
      id: string;
      data: Record<string, unknown>;
    }>;
    const collection = op.resourceType as CollectionSlug;

    await Promise.all(
      beforeSnapshot.map(async (item) => {
        return payload.update({
          collection,
          id: item.id,
          // Snapshot restore: shape varies by resourceType
          data: item.data as { [key: string]: never },
        });
      }),
    );

    const undoRecord = await payload.update({
      collection: "bulk-operations",
      id,
      data: {
        canUndo: false,
        undoneAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      message: "Bulk operation undone successfully",
      operation: undoRecord,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo operation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
