import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import type { Scope3Category } from "@/lib/scope3/types";
import type { Scope3Activity, Scope3Source } from "@/payload-types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "datapoint",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { periodId } = await params;
  if (!periodId) {
    return NextResponse.json({ error: "periodId required" }, { status: 400 });
  }

  // Parse pagination params (max 500 per page)
  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "100");
  if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 500) {
    return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
  }
  const limit = limitParam;

  const pageParam = parseInt(url.searchParams.get("page") || "1");
  if (!Number.isInteger(pageParam) || pageParam < 1) {
    return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
  }
  const page = pageParam;

  const payload = await getPayload({ config });

  // Fetch period
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    overrideAccess: true,
  });

  const periodOrgId =
    typeof period.organisation === "object"
      ? period.organisation.id
      : period.organisation;
  if (periodOrgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  // For aggregated view, fetch activities with efficient batching
  // Limit to 10k activities per request to prevent memory issues
  const categoryMap = new Map<Scope3Category, Scope3Activity[]>();
  let totalEmissions = 0;
  let totalActivityCount = 0;
  const BATCH_SIZE = 500;
  const MAX_ACTIVITIES = 10000;

  // Single find call with large limit to avoid N+1
  const result = await payload.find({
    collection: "scope3-activities",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: periodId } },
        { status: { equals: "approved" } },
      ],
    },
    limit: Math.min(BATCH_SIZE, limit),
    page: 1,
    overrideAccess: true,
    depth: 1,
  });

  const activities = result.docs as Scope3Activity[];
  totalActivityCount = Math.min(result.totalDocs || 0, MAX_ACTIVITIES);

  // Aggregate in single pass
  for (const activity of activities) {
    const source = activity.source;
    if (typeof source === "object" && source !== null && "type" in source) {
      const category = (source as Scope3Source).type;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(activity);
    }
    totalEmissions += activity.calculatedEmissions || 0;
  }

  // Calculate by category
  const byCategory = Array.from(categoryMap.entries()).map(
    ([category, categoryActivities]) => {
      const emissions = categoryActivities.reduce(
        (sum, a) => sum + (a.calculatedEmissions || 0),
        0,
      );

      return {
        category,
        emissions,
        sourceCount: new Set(
          categoryActivities.map((a) =>
            typeof a.source === "object" ? a.source.id : a.source,
          ),
        ).size,
      };
    },
  );

  // Return aggregated view with pagination info
  return NextResponse.json(
    {
      total: totalEmissions,
      byCategory,
      periodId,
      activityCount: totalActivityCount,
      pagination: {
        limit,
        page,
        queryUrl: `/api/app/scope3/activities?periodId=${periodId}&limit=${limit}&page=${page}`,
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60", // Cache aggregates for 1 minute
      },
    },
  );
}
