import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/** Toggle organisations.benchmarkOptOut — opted-out orgs neither contribute nor appear. */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const body = (await req.json()) as { optOut?: boolean };
  if (typeof body.optOut !== "boolean") {
    return NextResponse.json({ error: "optOut boolean required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const before = Boolean(ctx.activeOrg.benchmarkOptOut);
  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: { benchmarkOptOut: body.optOut },
    overrideAccess: true,
  });
  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: body.optOut ? "benchmark.opt_out" : "benchmark.opt_in",
    entityType: "organisations",
    entityId: ctx.activeOrg.id,
    before: { benchmarkOptOut: before },
    after: { benchmarkOptOut: body.optOut },
  });

  return NextResponse.json({ ok: true, benchmarkOptOut: body.optOut });
}
