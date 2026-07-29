import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });
  const role = await payload.findByID({
    collection: "custom-roles",
    id,
    depth: 1,
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const orgId =
    typeof role.organisation === "object" && role.organisation
      ? role.organisation.id
      : role.organisation;

  if (orgId !== ctx.activeOrg.id && !role.isTemplate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ role });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "custom-roles",
    ctx.activeOrg.id,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const payload = await getPayload({ config });

  try {
    const role = await payload.update({
      collection: "custom-roles",
      id,
      data: body,
    });

    return NextResponse.json({ role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "delete",
    "custom-roles",
    ctx.activeOrg.id,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });

  try {
    await payload.delete({
      collection: "custom-roles",
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
