import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user) {
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

  const isInitiator =
    op.actor === ctx.user.id ||
    (typeof op.actor === "object" && op.actor && op.actor.id === ctx.user.id);
  if (!isInitiator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      canUndo: op.canUndo && !op.undoneAt,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user) {
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

  const isInitiator =
    op.actor === ctx.user.id ||
    (typeof op.actor === "object" && op.actor && op.actor.id === ctx.user.id);
  if (!isInitiator) {
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
