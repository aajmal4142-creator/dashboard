import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { PolicyService } from "@/lib/policy/service";
import type { Capability } from "@/lib/policy/types";
import config from "@/payload.config";

/**
 * GET /api/app/policies/roles
 * List all available policy roles (admin only).
 */
export async function GET() {
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

    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);
    const roles = await policyService.listRoles();

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/policies/roles
 * Create a new custom role (admin only).
 */
export async function POST(request: Request) {
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

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      capabilities?: Capability[];
    };

    if (!body.name || !body.description || !body.capabilities) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, capabilities" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);

    const role = await policyService.createRole({
      organisationId: ctx.activeOrg.id,
      name: body.name,
      description: body.description,
      capabilities: body.capabilities,
    });

    if (!role) {
      return NextResponse.json({ error: "Failed to create role" }, { status: 400 });
    }

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("Error creating role:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
