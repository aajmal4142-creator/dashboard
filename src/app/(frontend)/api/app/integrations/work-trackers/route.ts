import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  createWorkTrackerConnectionForOrg,
  isWorkTrackerProvider,
  listWorkTrackerConnectionsForOrg,
} from "@/lib/integrations/workTrackers";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/integrations/work-trackers — list connections for active org.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const connections = await listWorkTrackerConnectionsForOrg(payload, ctx.activeOrg.id);

  return NextResponse.json({ connections });
}

/**
 * POST /api/app/integrations/work-trackers — create connection (encrypts token).
 */
export async function POST(request: Request) {
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

  if (!isWorkTrackerProvider(body.provider)) {
    return NextResponse.json(
      { error: "provider must be jira or linear" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const result = await createWorkTrackerConnectionForOrg(payload, {
    organisationId: ctx.activeOrg.id,
    userId: ctx.user.id,
    input: {
      provider: body.provider,
      label: typeof body.label === "string" ? body.label : "",
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : null,
      workspaceKey: typeof body.workspaceKey === "string" ? body.workspaceKey : null,
      accountEmail: typeof body.accountEmail === "string" ? body.accountEmail : null,
      apiToken: typeof body.apiToken === "string" ? body.apiToken : "",
      projectOrTeamId:
        typeof body.projectOrTeamId === "string" ? body.projectOrTeamId : "",
      projectOrTeamName:
        typeof body.projectOrTeamName === "string" ? body.projectOrTeamName : null,
      issueTypeName: typeof body.issueTypeName === "string" ? body.issueTypeName : null,
      enabled: body.enabled !== false,
      testBeforeSave: body.testBeforeSave !== false,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ connection: result.connection }, { status: 201 });
}
