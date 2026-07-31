import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getApiContext } from "@/lib/auth/apiContext";
import { flattenHierarchyForSwitcher, getHierarchyTree } from "@/lib/consolidation";
import config from "@/payload.config";

/**
 * GET /api/app/organisations/hierarchy
 * Full hierarchy tree for Membership-accessible organisations only.
 */
export async function GET() {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessibleOrgIds = ctx.memberships.map((m) => m.organisationId);
  const payload = await getPayload({ config });
  const { forest, orgs } = await getHierarchyTree(payload, accessibleOrgIds);
  const switcher = flattenHierarchyForSwitcher(forest);

  return NextResponse.json({
    forest,
    switcher,
    orgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      parentId: o.parentId,
      consolidationMethod: o.consolidationMethod,
      ownershipPercent: o.ownershipPercent,
    })),
    activeOrgId: ctx.activeOrg.id,
  });
}
