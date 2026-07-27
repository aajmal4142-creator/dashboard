import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { log } from "@/lib/observability/log";
import config from "@/payload.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const payload = await getPayload({ config });
    // Lightweight ping — count orgs with limit 0 still hits DB.
    await payload.find({
      collection: "organisations",
      limit: 0,
      overrideAccess: true,
    });
    const body = {
      ok: true as const,
      service: "clearesg",
      db: "up",
      ms: Date.now() - started,
      ts: new Date().toISOString(),
    };
    log.info("health.ok", { ms: body.ms });
    return NextResponse.json(body);
  } catch (err) {
    log.error("health.fail", {
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        service: "clearesg",
        db: "down",
        ms: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
