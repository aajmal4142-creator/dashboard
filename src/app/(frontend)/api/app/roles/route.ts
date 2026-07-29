import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "custom-roles",
    ctx.activeOrg.id,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const isTemplate = url.searchParams.get("isTemplate") === "true";
  const search = url.searchParams.get("search");

  const where: Where[] = isTemplate
    ? [{ isTemplate: { equals: true } }]
    : [{ organisation: { equals: ctx.activeOrg.id } }];

  if (search) {
    where.push({
      or: [{ name: { contains: search } }, { description: { contains: search } }],
    });
  }

  const payload = await getPayload({ config });
  const roles = await payload.find({
    collection: "custom-roles",
    where: { and: where },
    sort: "-createdAt",
    limit: 100,
    depth: 1,
  });

  return NextResponse.json({
    roles: roles.docs.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isTemplate: r.isTemplate,
      permissions: r.permissions,
      resourceScopes: r.resourceScopes,
      memberCount: r.memberCount,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "custom-roles",
    ctx.activeOrg.id,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, permissions, resourceScopes, inheritsFrom, isTemplate } =
    body;

  if (!name || !permissions) {
    return NextResponse.json(
      { error: "Missing required fields: name, permissions" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });

  try {
    const role = await payload.create({
      collection: "custom-roles",
      data: {
        organisation: ctx.activeOrg.id,
        name,
        description,
        permissions,
        resourceScopes,
        inheritsFrom,
        isTemplate,
        memberCount: 0,
      },
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
