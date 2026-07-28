import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * GET /api/app/policies/audit-logs
 * Query: userId, organisationId, resource, action, decision, limit, offset
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const organisationId = searchParams.get("organisationId");
    const resource = searchParams.get("resource");
    const action = searchParams.get("action");
    const decision = searchParams.get("decision");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!organisationId) {
      return Response.json({ error: "organisationId is required" }, { status: 400 });
    }

    const payload = await getPayload({ config });

    // Build where clause
    const whereConditions = [];
    whereConditions.push({ organisationId: { equals: organisationId } });

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

    return Response.json({
      docs: result.docs,
      totalDocs: result.totalDocs,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
