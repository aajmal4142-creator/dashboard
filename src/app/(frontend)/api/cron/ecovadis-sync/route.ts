import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@/payload.config";
import { isProductionRuntime } from "@/lib/launch/gates";
import { syncEcoVadisSuppliers } from "@/lib/integrations/ecovadis/sync";

/**
 * Vercel cron → EcoVadis daily sync at 2 AM UTC.
 * CRON_SECRET required in production.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (isProductionRuntime()) {
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET required in production" },
        { status: 503 },
      );
    }
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = await getPayload({ config });

    // Find all connected EcoVadis integrations
    const connections = await payload.find({
      collection: "ecovadis-connections",
      where: { status: { equals: "connected" } },
      limit: 1000,
      overrideAccess: true,
    });

    const results = [];

    for (const conn of connections.docs) {
      if (!conn.organisation) continue;

      const orgId = typeof conn.organisation === "string"
        ? conn.organisation
        : conn.organisation.id;

      try {
        const syncResult = await syncEcoVadisSuppliers(orgId);
        results.push(syncResult);
      } catch (error) {
        results.push({
          success: false,
          organisationId: orgId,
          error: String(error),
          suppliersProcessed: 0,
          suppliersUpdated: 0,
          suppliersWithErrors: 0,
          errors: [String(error)],
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      syncsRun: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
