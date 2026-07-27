import type { Where } from "payload";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/** Filterable immutable change log. §15.2 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }
  if (ctx.role === "viewer" || ctx.role === "contributor") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");

  const and: Where[] = [{ organisation: { equals: ctx.activeOrg.id } }];
  if (action) and.push({ action: { equals: action } });
  if (entityType) and.push({ entityType: { equals: entityType } });

  const payload = await getPayload({ config });
  const logs = await payload.find({
    collection: "audit-logs",
    where: { and },
    sort: "-createdAt",
    limit: 100,
    depth: 1,
    overrideAccess: true,
  });

  return NextResponse.json({
    logs: logs.docs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      before: l.before,
      after: l.after,
      createdAt: l.createdAt,
      actor:
        typeof l.actor === "object" && l.actor && "email" in l.actor
          ? { id: l.actor.id, email: l.actor.email }
          : null,
    })),
  });
}
