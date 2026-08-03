import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  isClearEsgEntityType,
  pushClearEsgEntityToWorkTracker,
} from "@/lib/integrations/workTrackers";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/app/integrations/work-trackers/[id]/push
 * Create a Jira issue or Linear task from a ClearESG entity.
 */
export async function POST(request: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "organisation",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isClearEsgEntityType(body.entityType)) {
    return NextResponse.json(
      { error: "entityType must be internal_request or compliance_obligation" },
      { status: 400 },
    );
  }

  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";
  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }

  const { id } = await context.params;
  const payload = await getPayload({ config });

  const originHeader = request.headers.get("origin");
  const appOrigin =
    originHeader ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    null;

  const result = await pushClearEsgEntityToWorkTracker(payload, {
    organisationId: ctx.activeOrg.id,
    organisationName: ctx.activeOrg.name || null,
    userId: ctx.user.id,
    connectionId: id,
    entityType: body.entityType,
    entityId,
    appOrigin,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    externalId: result.externalId,
    externalKey: result.externalKey,
    externalUrl: result.externalUrl,
    connection: result.connection,
  });
}
