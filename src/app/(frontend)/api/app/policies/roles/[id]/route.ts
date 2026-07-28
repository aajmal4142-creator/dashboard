import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { PolicyService } from "@/lib/policy/service";
import type { Capability } from "@/lib/policy/types";
import config from "@/payload.config";

/**
 * PUT /api/app/policies/roles/[id]
 * Update a custom role (admin only).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    // Check if role is system role
    const role = await payload.findByID({
      collection: "policy-roles",
      id,
      depth: 0,
    });

    const roleObj = role as unknown as Record<string, unknown>;
    if (roleObj.isSystem === true) {
      return NextResponse.json({ error: "Cannot modify system roles" }, { status: 400 });
    }

    // Update the role
    const updated = await payload.update({
      collection: "policy-roles",
      id,
      data: {
        name: body.name,
        description: body.description,
        defaultCapabilities: body.capabilities,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating role:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/app/policies/roles/[id]
 * Delete a custom role (admin only).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const success = await policyService.deleteRole(id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete role" }, { status: 400 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
