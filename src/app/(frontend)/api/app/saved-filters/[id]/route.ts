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
  const filter = await payload.findByID({
    collection: "saved-filters",
    id,
    depth: 1,
  });

  if (!filter) {
    return NextResponse.json({ error: "Filter not found" }, { status: 404 });
  }

  const isOwner =
    filter.owner === ctx.user.id ||
    (typeof filter.owner === "object" && filter.owner && filter.owner.id === ctx.user.id);
  const isShared = filter.isSharedWithTeam;

  if (!isOwner && !isShared) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ filter });
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

  const filter = await payload.findByID({
    collection: "saved-filters",
    id,
  });

  if (!filter) {
    return NextResponse.json({ error: "Filter not found" }, { status: 404 });
  }

  const isOwner =
    filter.owner === ctx.user.id ||
    (typeof filter.owner === "object" && filter.owner && filter.owner.id === ctx.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updated = await payload.update({
      collection: "saved-filters",
      id,
      data: body,
    });

    return NextResponse.json({ filter: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update filter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });

  const filter = await payload.findByID({
    collection: "saved-filters",
    id,
  });

  if (!filter) {
    return NextResponse.json({ error: "Filter not found" }, { status: 404 });
  }

  const isOwner =
    filter.owner === ctx.user.id ||
    (typeof filter.owner === "object" && filter.owner && filter.owner.id === ctx.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await payload.delete({
      collection: "saved-filters",
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete filter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
