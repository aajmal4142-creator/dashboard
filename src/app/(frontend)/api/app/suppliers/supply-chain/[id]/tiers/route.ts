import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  parseScope,
  parseStrength,
  type RelationshipStrength,
  type SupplyChainScope,
} from "@/lib/suppliers/supplyChainMap";
import { updateNetworkTiers } from "@/lib/suppliers/supplyChainService";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PUT /api/app/suppliers/supply-chain/[id]/tiers — update configurable tier assignments
 */
export async function PUT(req: Request, ctxRoute: RouteCtx) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctxRoute.params;
  if (!id) {
    return NextResponse.json({ error: "Network id required" }, { status: 400 });
  }

  let body: {
    updates?: Array<{
      id?: string;
      tier?: number;
      parentId?: string | null;
      scope?: string;
      relationshipStrength?: string | null;
    }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json(
      { error: "updates must be a non-empty array of { id, tier?, parentId?, scope? }" },
      { status: 400 },
    );
  }

  const updates: Array<{
    id: string;
    tier?: number;
    parentId?: string | null;
    scope?: SupplyChainScope;
    relationshipStrength?: RelationshipStrength | null;
  }> = [];

  for (const row of body.updates) {
    if (!row || typeof row.id !== "string" || !row.id) {
      return NextResponse.json(
        { error: "Each update requires a string id" },
        { status: 400 },
      );
    }
    const entry: (typeof updates)[number] = { id: row.id };
    if (row.tier !== undefined) {
      const t = Number(row.tier);
      if (!Number.isFinite(t) || t < 1 || t > 5) {
        return NextResponse.json(
          { error: "tier must be an integer between 1 and 5" },
          { status: 400 },
        );
      }
      entry.tier = Math.round(t);
    }
    if (row.parentId !== undefined) {
      entry.parentId = row.parentId;
    }
    if (row.scope !== undefined) {
      entry.scope = parseScope(row.scope);
    }
    if (row.relationshipStrength !== undefined) {
      entry.relationshipStrength =
        row.relationshipStrength === null
          ? null
          : parseStrength(row.relationshipStrength);
    }
    updates.push(entry);
  }

  const payload = await getPayload({ config });
  const result = await updateNetworkTiers({
    payload,
    organisationId: ctx.activeOrg.id,
    networkKey: id,
    updates,
  });

  return NextResponse.json({
    id,
    updated: result.updated,
  });
}
