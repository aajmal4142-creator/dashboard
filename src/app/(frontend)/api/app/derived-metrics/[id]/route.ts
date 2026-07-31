import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildAllowedFormulaKeys,
  deleteDerivedMetricDef,
  findDerivedMetricDefById,
  findMetricDefinitionKeys,
  mapCustomMetricDoc,
  orgIdFromCustomDoc,
  parseUpdateCustomMetricBody,
  updateDerivedMetricDef,
} from "@/lib/derive";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadOwnedCustom(id: string, orgId: string) {
  const payload = await getPayload({ config });
  let doc: Awaited<ReturnType<typeof findDerivedMetricDefById>>;
  try {
    doc = await findDerivedMetricDefById(payload, id);
  } catch {
    return null;
  }
  if (doc.source !== "custom") return null;
  if (orgIdFromCustomDoc(doc) !== orgId) return null;
  return { payload, doc };
}

/** GET /api/app/derived-metrics/[id] */
export async function GET(_req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const owned = await loadOwnedCustom(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const metric = mapCustomMetricDoc(owned.doc);
    if (!metric) {
      return NextResponse.json({ error: "Invalid metric" }, { status: 500 });
    }

    return NextResponse.json({ metric });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching derived metric:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH /api/app/derived-metrics/[id] */
export async function PATCH(req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage custom metrics." },
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

    const owned = await loadOwnedCustom(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rawKeys = await findMetricDefinitionKeys(owned.payload);
    const { allowed } = buildAllowedFormulaKeys(rawKeys);
    const parsed = parseUpdateCustomMetricBody(body, allowed);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateDerivedMetricDef(owned.payload, owned.doc.id, {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.unit !== undefined ? { unit: parsed.data.unit } : {}),
      ...(parsed.data.formula !== undefined ? { formula: parsed.data.formula } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    });

    const metric = mapCustomMetricDoc(updated);
    return NextResponse.json({ metric });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating derived metric:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/app/derived-metrics/[id] */
export async function DELETE(_req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage custom metrics." },
        { status: 403 },
      );
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const owned = await loadOwnedCustom(id, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteDerivedMetricDef(owned.payload, owned.doc.id);
    return NextResponse.json({ ok: true, id: owned.doc.id });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting derived metric:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
