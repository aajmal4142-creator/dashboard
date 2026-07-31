import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { runScheduledAutomations } from "@/lib/automations/engine";
import { isProductionRuntime } from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * Vercel cron → run schedule-trigger automations whose cron matches now.
 * CRON_SECRET required in production.
 * Schedule: every 5 minutes (vercel.json).
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
  } else if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = await getPayload({ config });
    const listed = await payload.find({
      collection: "automations",
      where: {
        and: [{ triggerType: { equals: "schedule" } }, { enabled: { equals: true } }],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
      select: { organisation: true },
    });

    const orgIds = new Set<string>();
    for (const doc of listed.docs) {
      const org =
        typeof doc.organisation === "string"
          ? doc.organisation
          : doc.organisation &&
              typeof doc.organisation === "object" &&
              "id" in doc.organisation
            ? String((doc.organisation as { id: string }).id)
            : null;
      if (org) orgIds.add(org);
    }

    const now = new Date();
    const orgResults: Array<{
      organisationId: string;
      evaluated: number;
      matched: number;
    }> = [];

    for (const organisationId of orgIds) {
      const result = await runScheduledAutomations(payload, organisationId, {
        actorId: null,
        now,
      });
      orgResults.push({
        organisationId,
        evaluated: result.evaluated,
        matched: result.matched,
      });
    }

    return NextResponse.json({
      ok: true,
      organisations: orgIds.size,
      results: orgResults,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Automation schedule cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
