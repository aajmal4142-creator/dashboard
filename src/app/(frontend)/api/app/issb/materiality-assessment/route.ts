import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * POST /api/app/issb/materiality-assessment
 * Summarise latest materiality assessment for ISSB S1 autofill context.
 */
export async function POST() {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await getPayload({ config });
  const mat = await payload.find({
    collection: "materiality-assessments",
    where: { organisation: { equals: auth.activeOrg.id } },
    sort: "-updatedAt",
    limit: 1,
    overrideAccess: true,
  });
  const doc = mat.docs[0];
  if (!doc) {
    return NextResponse.json({
      found: false,
      note: "No materiality assessment on file. Complete the Materiality workshop first.",
    });
  }

  const topicCount = Array.isArray(doc.topics) ? doc.topics.length : 0;
  return NextResponse.json({
    found: true,
    id: doc.id,
    status: doc.status,
    narrative: doc.narrative ?? null,
    topicCount,
    note:
      doc.narrative ||
      `Materiality assessment ${doc.status} with ${topicCount} topics. Use as input for ISSB S1 materiality judgement.`,
  });
}
