import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

import { requireOrgMember } from "../../../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * GET /api/app/database/connections/[id]/logs — sync history / status.
 */
export async function GET(request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  const denied = requireOrgMember(auth);
  if (denied) return denied;

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const payload = await getPayload({ config });
  const connection = await payload.findByID({
    collection: "database-connections",
    id,
    depth: 0,
    overrideAccess: true,
  });
  if (orgIdOf(connection.organisation) !== auth.activeOrg!.id) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const logs = await payload.find({
    collection: "database-sync-logs",
    where: {
      and: [
        { organisation: { equals: auth.activeOrg!.id } },
        { connection: { equals: id } },
      ],
    },
    sort: "-createdAt",
    limit,
    depth: 0,
    overrideAccess: true,
  });

  return NextResponse.json({
    connectionId: id,
    lastSyncAt: connection.lastSyncAt ?? null,
    lastSyncStatus: connection.lastSyncStatus ?? null,
    lastError: connection.lastError ?? null,
    nextSyncAt: connection.nextSyncAt ?? null,
    logs: logs.docs.map((log) => ({
      id: log.id,
      status: log.status,
      engine: log.engine,
      recordsProcessed: log.recordsProcessed ?? 0,
      recordsFailed: log.recordsFailed ?? 0,
      recordsSkipped: log.recordsSkipped ?? 0,
      syncDurationMs: log.syncDurationMs ?? null,
      triggeredBy: log.triggeredBy ?? null,
      startedAt: log.startedAt ?? null,
      completedAt: log.completedAt ?? null,
      errors: log.errors ?? [],
      details: log.details ?? null,
      createdAt: log.createdAt,
    })),
  });
}
