import { NextResponse } from "next/server";

import { isProductionRuntime } from "@/lib/launch/gates";

/**
 * Vercel cron → benchmarks recompute.
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
  } else if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/app/benchmarks/recompute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-clearesg-cron": "1",
    },
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
