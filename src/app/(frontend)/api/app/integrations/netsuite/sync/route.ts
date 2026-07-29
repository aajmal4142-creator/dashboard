import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import { NetSuiteService } from "@/lib/integrations/netsuite";

const NETSUITE_CLIENT_ID = process.env.NETSUITE_CLIENT_ID || "";
const NETSUITE_CLIENT_SECRET = process.env.NETSUITE_CLIENT_SECRET || "";
const NETSUITE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/netsuite/callback`;

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "organisation",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { connectionId?: string; periodId?: string };
  const { connectionId, periodId } = body;

  if (!connectionId || !periodId) {
    return NextResponse.json(
      { error: "Missing connectionId or periodId" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });

  const connection = await payload.findByID({
    collection: "netsuite-connections",
    id: connectionId,
    overrideAccess: true,
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (String(connection.organisationId) !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const service = new NetSuiteService(
      payload,
      NETSUITE_CLIENT_ID,
      NETSUITE_CLIENT_SECRET,
      NETSUITE_REDIRECT_URI,
    );

    const result = await service.syncGLData(connectionId, ctx.activeOrg.id, periodId);

    await payload.create({
      collection: "integration-sync-logs",
      data: {
        organisationId: ctx.activeOrg.id,
        integrationId: connectionId,
        provider: "netsuite",
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        details: result.details,
        errors: result.errors,
        syncDurationMs: result.syncDurationMs,
        triggeredBy: ctx.user.id,
      },
      overrideAccess: true,
    });

    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg, status: "failed" }, { status: 500 });
  }
}
