import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  activitiesToCsv,
  buildActivityFeedWhere,
  mapAuditLogToActivity,
  parseActivityFeedParams,
  type ActivityActorInput,
  type ActivityFeedFilters,
} from "@/lib/activity";
import config from "@/payload.config";

const EXPORT_LIMIT = 10_000;

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

async function exportActivities(filters: ActivityFeedFilters) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "audit-logs",
    where: buildActivityFeedWhere(ctx.activeOrg.id, filters),
    sort: "-createdAt",
    limit: EXPORT_LIMIT,
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

  const csv = activitiesToCsv(activities);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-feed-${stamp}.csv"`,
    },
  });
}

function filtersFromBody(body: Record<string, unknown>): ActivityFeedFilters {
  const str = (key: string): string | null => {
    const v = body[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    userId: str("userId") ?? str("user"),
    type: str("type") ?? str("action"),
    resourceType: str("resourceType") ?? str("entityType"),
    dateFrom: str("dateFrom") ?? str("startDate"),
    dateTo: str("dateTo") ?? str("endDate"),
  };
}

/** CSV export of the org activity feed (GET with query or POST with JSON body). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return exportActivities(parseActivityFeedParams(url.searchParams));
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }
  return exportActivities(filtersFromBody(body));
}
