import { NextResponse } from "next/server";

import { requireVerifiedSlackRequest } from "../_verify";

/**
 * POST /api/app/integrations/slack/interactions
 * Interactive components — signature verified; response stubbed.
 */
export async function POST(req: Request) {
  const verified = await requireVerifiedSlackRequest(req);
  if (verified instanceof Response) return verified;

  const params = new URLSearchParams(verified.rawBody);
  const payloadRaw = params.get("payload") || verified.rawBody;

  let interactionType = "unknown";
  try {
    const parsed = JSON.parse(payloadRaw) as { type?: string };
    if (typeof parsed.type === "string") interactionType = parsed.type;
  } catch {
    /* payload may be opaque */
  }

  console.info(`[slack] interactions stub type=${interactionType}`);

  return NextResponse.json({
    response_type: "ephemeral",
    text: "ClearESG received the interaction. Interactive handlers are not enabled yet.",
  });
}
