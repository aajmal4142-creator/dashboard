import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * GET /api/app/policies/users?userId=...&organisationId=...
 * Get user's policy for an organisation.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const organisationId = searchParams.get("organisationId");

    if (!userId || !organisationId) {
      return Response.json(
        { error: "userId and organisationId query parameters required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    const userPolicy = await payload.find({
      collection: "user-policies",
      where: {
        and: [{ user: { equals: userId } }, { organisation: { equals: organisationId } }],
      },
      limit: 1,
    });

    if (!userPolicy.docs || userPolicy.docs.length === 0) {
      return Response.json({ error: "No policy found" }, { status: 404 });
    }

    return Response.json(userPolicy.docs[0]);
  } catch (error) {
    console.error("Error fetching user policy:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/policies/users
 * Create or update user policy.
 */

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config });
    const body = await request.json();

    const { userId, organisationId, roleId, customCapabilities, notes } = body;

    if (!userId || !organisationId || !roleId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if policy exists
    const existingPolicy = await payload.find({
      collection: "user-policies",
      where: {
        and: [{ user: { equals: userId } }, { organisation: { equals: organisationId } }],
      },
      limit: 1,
    });

    if (existingPolicy.docs && existingPolicy.docs.length > 0) {
      // Update existing
      const policyId = existingPolicy.docs[0].id;
      const updated = await payload.update({
        collection: "user-policies",
        id: policyId,
        data: {
          role: roleId,
          customCapabilities: customCapabilities || [],
          notes,
        },
      });

      return Response.json(updated);
    }

    // Create new
    const created = await payload.create({
      collection: "user-policies",
      data: {
        user: userId,
        organisation: organisationId,
        role: roleId,
        customCapabilities: customCapabilities || [],
        notes,
      },
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("Error managing user policy:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
