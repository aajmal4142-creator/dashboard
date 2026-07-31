import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { listOrgQuestionnaires } from "@/lib/suppliers";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/questionnaires
 * Org-scoped engagement list + progress (e.g. 23/40 completed).
 */
export async function GET() {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "supplier",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const { questionnaires, progress } = await listOrgQuestionnaires(
    payload,
    auth.activeOrg.id,
  );

  return NextResponse.json({ questionnaires, progress });
}
