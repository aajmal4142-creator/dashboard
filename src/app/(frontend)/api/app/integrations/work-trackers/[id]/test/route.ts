import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { testWorkTrackerConnectionForOrg } from "@/lib/integrations/workTrackers";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/app/integrations/work-trackers/[id]/test
 * Validates stored (or one-shot) credentials against provider REST/GraphQL.
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

  let apiTokenOverride: string | null = null;
  try {
    const body = (await request.json()) as { apiToken?: string };
    if (typeof body.apiToken === "string" && body.apiToken.trim()) {
      apiTokenOverride = body.apiToken.trim();
    }
  } catch {
    // empty body is fine — use stored token
  }

  const { id } = await context.params;
  const payload = await getPayload({ config });
  const result = await testWorkTrackerConnectionForOrg(payload, {
    organisationId: ctx.activeOrg.id,
    id,
    apiTokenOverride,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    detail: result.detail,
    connection: result.connection,
  });
}
