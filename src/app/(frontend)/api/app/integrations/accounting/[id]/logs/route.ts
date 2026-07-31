import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

import { loadOwnedAccountingConnection } from "../../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/integrations/accounting/[id]/logs
 * Sync history + error log for one connection.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const connection = await loadOwnedAccountingConnection(payload, id, auth.activeOrg.id);
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const logs = await payload.find({
    collection: "integration-sync-logs",
    where: {
      and: [
        { organisationId: { equals: auth.activeOrg.id } },
        { integrationId: { equals: id } },
      ],
    },
    sort: "-createdAt",
    limit: 25,
    overrideAccess: true,
  });

  return NextResponse.json({
    logs: logs.docs.map((doc) => ({
      id: doc.id,
      status: doc.status,
      recordsProcessed: doc.recordsProcessed,
      recordsFailed: doc.recordsFailed,
      details: doc.details,
      errors: doc.errors,
      syncDurationMs: doc.syncDurationMs,
      triggeredBy: doc.triggeredBy,
      createdAt: doc.createdAt,
    })),
  });
}
