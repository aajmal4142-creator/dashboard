import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { listMappedAutomations, orgIdFromDoc, parseUpdateBody } from "@/lib/automations";
import {
  deleteAutomation,
  findAutomationById,
  updateAutomation,
} from "@/lib/automations/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadOwned(id: string, orgId: string) {
  const payload = await getPayload({ config });
  let doc: Awaited<ReturnType<typeof findAutomationById>>;
  try {
    doc = await findAutomationById(payload, id);
  } catch {
    return null;
  }
  if (orgIdFromDoc(doc) !== orgId) return null;
  return { payload, doc };
}

/** GET /api/app/automations/[id] */
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

    const automation = listMappedAutomations([owned.doc])[0];
    if (!automation) {
      return NextResponse.json({ error: "Invalid automation" }, { status: 500 });
    }

    return NextResponse.json({ automation });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH /api/app/automations/[id] */
export async function PATCH(req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage automations." },
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

    const updated = await updateAutomation(owned.payload, owned.doc.id, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.triggerType !== undefined
        ? { triggerType: parsed.data.triggerType }
        : {}),
      ...(parsed.data.cronExpression !== undefined
        ? { cronExpression: parsed.data.cronExpression }
        : {}),
      ...(parsed.data.conditions !== undefined
        ? { conditions: parsed.data.conditions }
        : {}),
      ...(parsed.data.actions !== undefined ? { actions: parsed.data.actions } : {}),
    });

    const automation = listMappedAutomations([updated])[0];
    return NextResponse.json({ automation });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/app/automations/[id] */
export async function DELETE(_req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage automations." },
        { status: 403 },
      );
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const owned = await loadOwned(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteAutomation(owned.payload, owned.doc.id);
    return NextResponse.json({ ok: true, id: owned.doc.id });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
