import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || auth.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "suppliers",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof existing.organisation === "object" && existing.organisation !== null
      ? existing.organisation.id
      : String(existing.organisation);
  if (orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    name?: string;
    contactEmail?: string;
    category?: string;
    annualSpend?: number | null;
  };

  const updated = await payload.update({
    collection: "suppliers",
    id,
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.contactEmail !== undefined
        ? { contactEmail: body.contactEmail.trim().toLowerCase() }
        : {}),
      ...(body.category !== undefined
        ? {
            category: body.category as
              | "purchased_goods"
              | "capital_goods"
              | "transport"
              | "waste"
              | "business_travel"
              | "other",
          }
        : {}),
      ...(body.annualSpend !== undefined
        ? { annualSpend: body.annualSpend ?? undefined }
        : {}),
    },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || (auth.role !== "owner" && auth.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "suppliers",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof existing.organisation === "object" && existing.organisation !== null
      ? existing.organisation.id
      : String(existing.organisation);
  if (orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await payload.delete({
    collection: "suppliers",
    id,
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true });
}
