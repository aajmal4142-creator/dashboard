import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import type { Scope3Category } from "@/lib/scope3/types";
import type { Scope3Activity, Scope3Source } from "@/payload-types";

export async function GET(
  _req: Request,
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

  // Fetch activities for this period
  const result = await payload.find({
    collection: "scope3-activities",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: periodId } },
        { status: { equals: "approved" } },
      ],
    },
    limit: 10000,
    overrideAccess: true,
    depth: 1,
  });

  const activities = result.docs as Scope3Activity[];

  // Aggregate by category
  const categoryMap = new Map<Scope3Category, Scope3Activity[]>();

  for (const activity of activities) {
    const source = activity.source;
    if (typeof source === "object" && source !== null && "type" in source) {
      const category = (source as Scope3Source).type;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(activity);
    }
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

  // Calculate total
  const total = activities.reduce((sum, a) => sum + (a.calculatedEmissions || 0), 0);

  return NextResponse.json({
    total,
    byCategory,
    periodId,
    activityCount: activities.length,
  });
}
