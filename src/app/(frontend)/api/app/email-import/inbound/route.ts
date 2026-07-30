import { NextResponse } from "next/server";

import { processInboundEmailImport, verifyResendWebhook } from "@/lib/emailImport";

export const runtime = "nodejs";

/**
 * POST /api/app/email-import/inbound
 *
 * Resend inbound webhook (email.received). Authenticated via Svix
 * (RESEND_WEBHOOK_SECRET). Pipeline: verify → whitelist → CSV → datapoints → reply.
 *
 * Configure Resend inbound to POST here. Attachments should include CSV content
 * (content / content_base64) or a pre-fetched text field.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifyResendWebhook({
    rawBody,
    headers: request.headers,
  });

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const result = await processInboundEmailImport({
      raw: verified.payload,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(
      "email-import inbound error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { ok: false, status: "failed", reason: "Internal server error" },
      { status: 500 },
    );
  }
}
