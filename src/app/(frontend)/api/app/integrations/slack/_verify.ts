import { NextResponse } from "next/server";

import {
  readSlackSignatureHeaders,
  resolveSlackCredentials,
  verifySlackSignature,
} from "@/lib/integrations/slack";

/**
 * Shared gate for Slack Events / Commands / Interactions stubs.
 * Returns raw body on success, or a Response to return immediately.
 */
export async function requireVerifiedSlackRequest(
  req: Request,
): Promise<{ rawBody: string } | Response> {
  const credentials = resolveSlackCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "Slack app credentials are not configured." },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const { signature, timestamp } = readSlackSignatureHeaders(req.headers);
  const valid = verifySlackSignature({
    signingSecret: credentials.signingSecret,
    signature,
    timestamp,
    rawBody,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });
  }

  return { rawBody };
}
