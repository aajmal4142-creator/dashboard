import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { mapAlertRuleDoc, orgIdFromDoc, parseUpdateBody } from "@/lib/alerts";
import { deleteAlertRule, findAlertRuleById, updateAlertRule } from "@/lib/alerts/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadOwned(id: string, orgId: string) {
  const payload = await getPayload({ config });
  let doc: Awaited<ReturnType<typeof findAlertRuleById>>;
  try {
    doc = await findAlertRuleById(payload, id);
  } catch {
    return null;
  }
  if (orgIdFromDoc(doc) !== orgId) return null;
  return { payload, doc };
}

/** GET /api/app/alerts/[id] */
export async function GET(_req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const owned = await loadOwned(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rule = mapAlertRuleDoc(owned.doc);
    if (!rule) return NextResponse.json({ error: "Invalid rule" }, { status: 500 });

    return NextResponse.json({ rule });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching alert rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH /api/app/alerts/[id] */
export async function PATCH(req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage alert rules." },
        { status: 403 },
      );
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

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

    const owned = await loadOwned(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await updateAlertRule(owned.payload, owned.doc.id, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.condition !== undefined
        ? { condition: parsed.data.condition }
        : {}),
      ...(parsed.data.actions !== undefined ? { actions: parsed.data.actions } : {}),
      ...(parsed.data.muted !== undefined ? { muted: parsed.data.muted } : {}),
      ...(parsed.data.mutedUntil !== undefined
        ? { mutedUntil: parsed.data.mutedUntil }
        : {}),
    });

    const rule = mapAlertRuleDoc(updated);
    return NextResponse.json({ rule });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating alert rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/app/alerts/[id] */
export async function DELETE(_req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage alert rules." },
        { status: 403 },
      );
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const owned = await loadOwned(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteAlertRule(owned.payload, owned.doc.id);
    return NextResponse.json({ ok: true, id: owned.doc.id });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting alert rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
