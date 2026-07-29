import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import { SalesforceService } from "@/lib/integrations/salesforce";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID || "";
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET || "";
const SALESFORCE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/salesforce/callback`;

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

  const body = (await req.json()) as { connectionId?: string };
  const { connectionId } = body;

  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  const payload = await getPayload({ config });

  const connection = await payload.findByID({
    collection: "salesforce-connections",
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
    const service = new SalesforceService(
      payload,
      SALESFORCE_CLIENT_ID,
      SALESFORCE_CLIENT_SECRET,
      SALESFORCE_REDIRECT_URI,
    );

    const result = await service.syncData(connectionId, ctx.activeOrg.id);

    await payload.create({
      collection: "integration-sync-logs",
      data: {
        organisationId: ctx.activeOrg.id,
        integrationId: connectionId,
        provider: "salesforce",
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
