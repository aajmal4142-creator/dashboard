import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { SAPService } from "@/lib/integrations/sap";
import config from "@/payload.config";

export async function POST(request: Request) {
  try {
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

    const organisationId = ctx.activeOrg.id;
    const { action, connectionId, periodId } = (await request.json()) as {
      action: string;
      connectionId: string;
      periodId: string;
    };

    const payload = await getPayload({ config });
    const sapService = new SAPService(
      payload,
      process.env.SAP_CLIENT_ID || "",
      process.env.SAP_CLIENT_SECRET || "",
      process.env.SAP_REDIRECT_URI || "",
    );

    if (action === "sync") {
      const result = await sapService.syncData(connectionId, organisationId, periodId);
      return NextResponse.json(result);
    }

    if (action === "get-auth-url") {
      const url = sapService.getAuthUrl(connectionId);
      return NextResponse.json({ authUrl: url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("SAP integration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration failed" },
      { status: 500 },
    );
  }
}
