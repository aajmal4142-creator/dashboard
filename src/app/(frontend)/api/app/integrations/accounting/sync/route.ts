import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

import { buildAccountingService, loadOwnedAccountingConnection } from "../_shared";

/**
 * Legacy POST /api/app/integrations/accounting/sync
 * Prefer POST /api/app/integrations/accounting/[id]/sync
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
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

  const body = (await req.json()) as { connectionId?: string; periodId?: string };
  const { connectionId, periodId } = body;

  if (!connectionId || !periodId) {
    return NextResponse.json(
      { error: "Missing connectionId or periodId" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const connection = await loadOwnedAccountingConnection(
    payload,
    connectionId,
    ctx.activeOrg.id,
  );
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const service = buildAccountingService(payload, connection);
    const result = await service.syncExpenses(connectionId, ctx.activeOrg.id, periodId, {
      actorId: ctx.user.id,
    });

    await payload.create({
      collection: "integration-sync-logs",
      data: {
        organisationId: ctx.activeOrg.id,
        integrationId: connectionId,
        provider: connection.provider,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        details: result.details,
        errors: result.errors,
        syncDurationMs: result.syncDurationMs,
        triggeredBy: ctx.user.id,
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "accounting.sync",
      entityType: "accounting-connections",
      entityId: connectionId,
      after: { status: result.status, recordsProcessed: result.recordsProcessed },
    });

    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg, status: "failed" }, { status: 500 });
  }
}
