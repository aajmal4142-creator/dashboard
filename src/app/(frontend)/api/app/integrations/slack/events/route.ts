import { NextResponse } from "next/server";

import { requireVerifiedSlackRequest } from "../_verify";

/**
 * POST /api/app/integrations/slack/events
 * Slack Events API — signature verified; url_verification handled; other events stubbed.
 */
export async function POST(req: Request) {
  const verified = await requireVerifiedSlackRequest(req);
  if (verified instanceof Response) return verified;

  let body: { type?: string; challenge?: string; event?: { type?: string } };
  try {
    body = JSON.parse(verified.rawBody) as {
      type?: string;
      challenge?: string;
      event?: { type?: string };
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type === "url_verification" && typeof body.challenge === "string") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Stub: acknowledge event delivery. Handlers land in a later pass.
  console.info(
    `[slack] events stub type=${body.type ?? "unknown"} event=${body.event?.type ?? "none"}`,
  );

  return NextResponse.json({ ok: true, stub: true });
}
