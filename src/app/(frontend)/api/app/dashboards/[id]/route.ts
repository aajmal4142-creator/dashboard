import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { mapLayoutDoc, ownershipMatches, parseUpdateBody } from "@/lib/dashboards";
import {
  clearOtherDefaults,
  deleteDashboardLayout,
  findDashboardLayoutById,
  updateDashboardLayout,
} from "@/lib/dashboards/store";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/app/dashboards/[id] — update name, widgets, and/or default flag. */
export async function PATCH(req: Request, routeCtx: Ctx) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const { id } = await routeCtx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseUpdateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = await getPayload({ config });
  let doc: Awaited<ReturnType<typeof findDashboardLayoutById>>;
  try {
    doc = await findDashboardLayoutById(payload, id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!ownershipMatches(doc, ctx.user.id, ctx.activeOrg.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await updateDashboardLayout(payload, doc.id, parsed.data);

  if (parsed.data.isDefault === true) {
    await clearOtherDefaults(payload, ctx.user.id, ctx.activeOrg.id, updated.id);
  }

  const layout = mapLayoutDoc(updated);
  return NextResponse.json({ layout });
}

/** DELETE /api/app/dashboards/[id] */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const { id } = await routeCtx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  let doc: Awaited<ReturnType<typeof findDashboardLayoutById>>;
  try {
    doc = await findDashboardLayoutById(payload, id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!ownershipMatches(doc, ctx.user.id, ctx.activeOrg.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteDashboardLayout(payload, doc.id);
  return NextResponse.json({ ok: true, id: doc.id });
}
