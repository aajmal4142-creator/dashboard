import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { PolicyService } from "@/lib/policy/service";
import config from "@/payload.config";

/**
 * GET /api/app/policies/users?organisationId=...
 * List all user policies for an organisation (admin only).
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
    const organisationId = searchParams.get("organisationId") || ctx.activeOrg.id;

    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);

    const policies = await policyService.listUserPolicies(organisationId);

    return NextResponse.json(policies);
  } catch (error) {
    console.error("Error fetching user policies:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
