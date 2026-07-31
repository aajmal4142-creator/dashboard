import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

import { buildAccountingService, loadOwnedAccountingConnection } from "../../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/integrations/accounting/[id]/sync
 * Body: { periodId: string }
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "organisation",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as { periodId?: string };
  if (!body.periodId) {
    return NextResponse.json({ error: "Missing periodId" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const connection = await loadOwnedAccountingConnection(payload, id, auth.activeOrg.id);
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  if (connection.status !== "connected") {
    return NextResponse.json(
      { error: "Connection is not active. Re-authorize before syncing." },
      { status: 400 },
    );
  }

  try {
    const service = buildAccountingService(payload, connection);
    const result = await service.syncExpenses(id, auth.activeOrg.id, body.periodId, {
      actorId: auth.user.id,
    });

    await payload.create({
      collection: "integration-sync-logs",
      data: {
        organisationId: auth.activeOrg.id,
        integrationId: id,
        provider: connection.provider,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        details: result.details,
        errors: result.errors,
        syncDurationMs: result.syncDurationMs,
        triggeredBy: auth.user.id,
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: auth.activeOrg.id,
      actorId: auth.user.id,
      action: "accounting.sync",
      entityType: "accounting-connections",
      entityId: id,
      after: {
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        periodId: body.periodId,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg, status: "failed" }, { status: 500 });
  }
}
