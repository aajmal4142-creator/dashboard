import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  deleteWorkTrackerConnectionForOrg,
  getOrgWorkTrackerConnection,
  mapWorkTrackerConnectionDoc,
  updateWorkTrackerConnectionForOrg,
} from "@/lib/integrations/workTrackers";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/integrations/work-trackers/[id]
 */
export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await getPayload({ config });
  const doc = await getOrgWorkTrackerConnection(payload, ctx.activeOrg.id, id);
  if (!doc) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  return NextResponse.json({ connection: mapWorkTrackerConnectionDoc(doc) });
}

/**
 * PATCH /api/app/integrations/work-trackers/[id]
 */
export async function PATCH(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const payload = await getPayload({ config });
  const result = await updateWorkTrackerConnectionForOrg(payload, {
    organisationId: ctx.activeOrg.id,
    id,
    input: {
      label: typeof body.label === "string" ? body.label : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      workspaceKey:
        "workspaceKey" in body && typeof body.workspaceKey === "string"
          ? body.workspaceKey
          : "workspaceKey" in body
            ? null
            : undefined,
      accountEmail:
        "accountEmail" in body && typeof body.accountEmail === "string"
          ? body.accountEmail
          : "accountEmail" in body
            ? null
            : undefined,
      apiToken: typeof body.apiToken === "string" ? body.apiToken : undefined,
      projectOrTeamId:
        typeof body.projectOrTeamId === "string" ? body.projectOrTeamId : undefined,
      projectOrTeamName:
        "projectOrTeamName" in body && typeof body.projectOrTeamName === "string"
          ? body.projectOrTeamName
          : "projectOrTeamName" in body
            ? null
            : undefined,
      issueTypeName:
        typeof body.issueTypeName === "string" ? body.issueTypeName : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      clearError: body.clearError === true,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ connection: result.connection });
}

/**
 * DELETE /api/app/integrations/work-trackers/[id]
 */
export async function DELETE(_request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const payload = await getPayload({ config });
  const result = await deleteWorkTrackerConnectionForOrg(payload, ctx.activeOrg.id, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
