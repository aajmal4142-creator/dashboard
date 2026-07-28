import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { PolicyService } from "@/lib/policy/service";
import type { Capability } from "@/lib/policy/types";
import config from "@/payload.config";

/**
 * PUT /api/app/policies/users/[userId]
 * Assign user to role with capability overrides (admin only).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
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
      baseRole?: string;
      capabilityOverrides?: {
        grantExtra?: Capability[];
        revokeCapability?: Capability[];
      };
    };

    if (!body.baseRole) {
      return NextResponse.json(
        { error: "Missing required field: baseRole" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);

    const updated = await policyService.setUserPolicies(userId, ctx.activeOrg.id, {
      baseRole: body.baseRole,
      capabilityOverrides: body.capabilityOverrides,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update user policy" },
        { status: 400 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating user policy:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
