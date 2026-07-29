import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "policy",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const action = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");
  const userId = url.searchParams.get("userId");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const where: Where[] = [{ organisation: { equals: ctx.activeOrg.id } }];

  if (action) {
    where.push({ action: { equals: action } });
  }

  if (entityType) {
    where.push({ entityType: { equals: entityType } });
  }

  if (userId) {
    where.push({ actor: { equals: userId } });
  }

  if (query) {
    where.push({
      or: [
        { action: { contains: query } },
        { entityType: { contains: query } },
        { entityId: { contains: query } },
      ],
    });
  }

  if (startDate || endDate) {
    where.push({
      createdAt: {
        ...(startDate ? { greater_than_equal: startDate } : {}),
        ...(endDate ? { less_than_equal: endDate } : {}),
      },
    });
  }

  const payload = await getPayload({ config });
  const logs = await payload.find({
    collection: "audit-logs",
    where: { and: where },
    sort: "-createdAt",
    limit,
    page: Math.floor(offset / limit) + 1,
    depth: 2,
  });

  return NextResponse.json({
    logs: logs.docs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      before: l.before,
      after: l.after,
      createdAt: l.createdAt,
      actor:
        typeof l.actor === "object" && l.actor && "email" in l.actor
          ? { id: l.actor.id, email: l.actor.email }
          : null,
      ip: l.ip,
      userAgent: l.userAgent,
    })),
    pagination: {
      total: logs.totalDocs,
      limit,
      offset,
      hasMore: offset + limit < logs.totalDocs,
    },
  });
}
