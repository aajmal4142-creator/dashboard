import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  buildActivityFeedWhere,
  mapAuditLogToActivity,
  parseActivityFeedParams,
  type ActivityActorInput,
} from "@/lib/activity";
import config from "@/payload.config";

function actorFromDoc(actor: unknown): ActivityActorInput {
  if (actor == null) return null;
  if (typeof actor === "string") return actor;
  if (typeof actor === "object" && actor !== null) {
    const row = actor as {
      id?: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    };
    return {
      id: row.id ?? null,
      email: row.email ?? null,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
    };
  }
  return null;
}

/** Org-scoped activity feed over AuditLogs with friendly display mapping. */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const filters = parseActivityFeedParams(url.searchParams);
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "audit-logs",
    where: buildActivityFeedWhere(ctx.activeOrg.id, filters),
    sort: "-createdAt",
    limit,
    page: Math.floor(offset / limit) + 1,
    depth: 1,
    overrideAccess: true,
  });

  const activities = result.docs.map((l) =>
    mapAuditLogToActivity({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      createdAt: l.createdAt,
      actor: actorFromDoc(l.actor),
      before: l.before,
      after: l.after,
    }),
  );

  return NextResponse.json({
    activities,
    total: result.totalDocs,
    pagination: {
      total: result.totalDocs,
      limit,
      offset,
      hasMore: offset + limit < result.totalDocs,
    },
  });
}
