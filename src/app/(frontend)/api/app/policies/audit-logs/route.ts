import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/policies/audit-logs
 * Query: userId, resource, action, decision, limit, offset
 * Admin only - filtered to current organisation.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "manage-policies",
      "policies",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const resource = searchParams.get("resource");
    const action = searchParams.get("action");
    const decision = searchParams.get("decision");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const payload = await getPayload({ config });

    // Build where clause - always filter to current organisation
    const whereConditions = [];
    whereConditions.push({ organisationId: { equals: ctx.activeOrg.id } });

    if (userId) {
      whereConditions.push({ userId: { equals: userId } });
    }
    if (resource) {
      whereConditions.push({ resource: { equals: resource } });
    }
    if (action) {
      whereConditions.push({ action: { equals: action } });
    }
    if (decision) {
      whereConditions.push({ decision: { equals: decision } });
    }

    const result = await payload.find({
      collection: "policy-evaluations",
      where: whereConditions.length === 1 ? whereConditions[0] : { and: whereConditions },
      limit,
      page: Math.floor(offset / limit) + 1,
      sort: "-evaluatedAt",
    });

    return NextResponse.json({
      docs: result.docs,
      totalDocs: result.totalDocs,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
