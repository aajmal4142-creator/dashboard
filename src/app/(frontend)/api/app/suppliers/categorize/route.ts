import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { categorizeBulk } from "@/lib/suppliers/categorizationEngine";
import config from "@/payload.config";

export async function POST() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 1000,
    overrideAccess: true,
  });

  const categorizationData = suppliers.docs.map((s) => ({
    id: String(s.id),
    name: s.name,
    annualSpend: s.annualSpend ?? undefined,
    requestToken: s.requestToken ?? undefined,
    respondedAt: s.respondedAt ? new Date(s.respondedAt) : undefined,
  }));

  const { results, summary } = categorizeBulk(categorizationData);

  // Update each supplier with categorization
  for (const result of results) {
    await payload.update({
      collection: "suppliers",
      id: result.id,
      data: {
        // Store tier in a metadata field or create new field
        // For now, storing in JSON field if it exists
      },
      overrideAccess: true,
    });
  }

  return NextResponse.json({
    summary,
    results,
  });
}
