import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { BIConnectorService } from "@/lib/integrations/biconnector";
import type { BiConnectorType, BiDatasetMapping } from "@/lib/integrations/types";
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
    const { action, connectionId, biType, mappings, schedule } =
      (await request.json()) as {
        action: string;
        connectionId: string;
        biType: BiConnectorType;
        mappings?: BiDatasetMapping[];
        schedule?: { time: string; days: string[] };
      };

    const payload = await getPayload({ config });
    const biService = new BIConnectorService(payload);

    if (action === "sync") {
      if (!mappings) {
        return NextResponse.json({ error: "Mappings required" }, { status: 400 });
      }
      const result = await biService.syncToBI(
        connectionId,
        organisationId,
        biType,
        mappings,
      );
      return NextResponse.json(result);
    }

    if (action === "test-connection") {
      const connected = await biService.testConnection(connectionId, biType);
      return NextResponse.json({ connected });
    }

    if (action === "schedule-refresh") {
      if (!schedule) {
        return NextResponse.json({ error: "Schedule required" }, { status: 400 });
      }
      await biService.scheduleRefresh(connectionId, biType, schedule);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("BI integration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration failed" },
      { status: 500 },
    );
  }
}
