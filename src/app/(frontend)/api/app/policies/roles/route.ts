import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * GET /api/app/policies/roles
 * List all available policy roles.
 */

export async function GET() {
  try {
    const payload = await getPayload({ config });

    const roles = await payload.find({
      collection: "policy-roles",
      limit: 1000,
    });

    return Response.json(roles.docs);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/policies/roles
 * Create a new custom role.
 */

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config });
    const body = await request.json();

    const { name, description, defaultCapabilities } = body;

    if (!name || !description || !defaultCapabilities) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const role = await payload.create({
      collection: "policy-roles",
      data: {
        name,
        description,
        defaultCapabilities,
        isSystem: false,
      },
    });

    return Response.json(role, { status: 201 });
  } catch (error) {
    console.error("Error creating role:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
