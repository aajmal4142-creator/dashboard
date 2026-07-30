import { Webhook } from "svix";

export type VerifyWebhookResult =
  { ok: true; payload: unknown } | { ok: false; error: string; status: number };

/**
 * Authenticate Resend inbound webhook via Svix signing secret.
 * Env: RESEND_WEBHOOK_SECRET (whsec_…).
 * Never logs the secret or raw signature material.
 */
export function verifyResendWebhook(opts: {
  rawBody: string;
  headers: Headers;
  secret?: string | null;
}): VerifyWebhookResult {
  const secret = (opts.secret ?? process.env.RESEND_WEBHOOK_SECRET)?.trim();
  if (!secret) {
    return {
      ok: false,
      error: "RESEND_WEBHOOK_SECRET is not configured",
      status: 503,
    };
  }

  const svixId = opts.headers.get("svix-id");
  const svixTimestamp = opts.headers.get("svix-timestamp");
  const svixSignature = opts.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return {
      ok: false,
      error: "Missing Svix webhook signature headers",
      status: 401,
    };
  }

  try {
    const wh = new Webhook(secret);
    const payload = wh.verify(opts.rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      error: "Webhook signature verification failed",
      status: 401,
    };
  }
}
