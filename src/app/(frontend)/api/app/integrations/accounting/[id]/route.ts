import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  isCategoryMappingEntry,
  parseCategoryMapping,
  type CategoryMapping,
} from "@/lib/integrations/accounting";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

import { loadOwnedAccountingConnection } from "../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/integrations/accounting/[id]
 * Public connection details (no tokens).
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

  return NextResponse.json({
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    connectionMode: connection.connectionMode,
    companyName: connection.companyName,
    providerId: connection.providerId,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
    nextSyncAt: connection.nextSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    syncErrorCount: connection.syncErrorCount,
    syncConfig: connection.syncConfig,
    expenseCategoryMapping: parseCategoryMapping(connection.expenseCategoryMapping),
    discoveredAccounts: connection.discoveredAccounts ?? [],
  });
}

/**
 * PATCH /api/app/integrations/accounting/[id]
 * Update category mapping and/or sync config.
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
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
  const body = (await req.json()) as {
    expenseCategoryMapping?: CategoryMapping;
    syncConfig?: {
      enableExpenseSync?: boolean;
      enableBankFeedSync?: boolean;
      enableAutoCateg?: boolean;
      syncFrequency?: "manual" | "daily" | "weekly" | "monthly";
    };
  };

  const payload = await getPayload({ config });
  const connection = await loadOwnedAccountingConnection(payload, id, auth.activeOrg.id);
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.expenseCategoryMapping) {
    const cleaned: CategoryMapping = {};
    for (const [key, entry] of Object.entries(body.expenseCategoryMapping)) {
      if (!key.trim() || !isCategoryMappingEntry(entry)) {
        return NextResponse.json(
          { error: `Invalid mapping entry for ${key}` },
          { status: 400 },
        );
      }
      cleaned[key.trim()] = entry;
    }
    data.expenseCategoryMapping = cleaned;
  }

  if (body.syncConfig) {
    data.syncConfig = {
      ...((connection.syncConfig as object) || {}),
      ...body.syncConfig,
    };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await payload.update({
    collection: "accounting-connections",
    id,
    data,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "accounting.update",
    entityType: "accounting-connections",
    entityId: id,
    after: { fields: Object.keys(data) },
  });

  return NextResponse.json({
    id: updated.id,
    expenseCategoryMapping: parseCategoryMapping(updated.expenseCategoryMapping),
    syncConfig: updated.syncConfig,
  });
}

/**
 * DELETE /api/app/integrations/accounting/[id]
 * Disconnect and clear encrypted tokens.
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
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
  const payload = await getPayload({ config });
  const connection = await loadOwnedAccountingConnection(payload, id, auth.activeOrg.id);
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Clear tokens then delete — revoke is best-effort (no paid API required).
  await payload.update({
    collection: "accounting-connections",
    id,
    data: {
      accessToken: null,
      refreshToken: null,
      status: "expired",
    },
    overrideAccess: true,
  });

  await payload.delete({
    collection: "accounting-connections",
    id,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "accounting.disconnect",
    entityType: "accounting-connections",
    entityId: id,
    after: { provider: connection.provider },
  });

  return NextResponse.json({ ok: true });
}
