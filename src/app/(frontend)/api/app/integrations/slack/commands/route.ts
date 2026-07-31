import { NextResponse } from "next/server";

import { requireVerifiedSlackRequest } from "../_verify";

/**
 * POST /api/app/integrations/slack/commands
 * Slash commands — signature verified; response stubbed.
 */
export async function POST(req: Request) {
  const verified = await requireVerifiedSlackRequest(req);
  if (verified instanceof Response) return verified;

  const params = new URLSearchParams(verified.rawBody);
  const command = params.get("command") || "";
  const text = params.get("text") || "";

  console.info(`[slack] commands stub command=${command} text=${text.slice(0, 80)}`);

  return NextResponse.json({
    response_type: "ephemeral",
    text: `ClearESG received \`${command} ${text}\`. Slash command handlers are not enabled yet.`,
  });
}
