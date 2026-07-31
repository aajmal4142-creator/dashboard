import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_MAX_AGE_SECONDS = 60 * 5;

/**
 * Verify Slack request signature (X-Slack-Signature + X-Slack-Request-Timestamp).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(args: {
  signingSecret: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  rawBody: string;
  nowSeconds?: number;
  maxAgeSeconds?: number;
}): boolean {
  const signature = args.signature?.trim() || "";
  const timestamp = args.timestamp?.trim() || "";
  if (!signature || !timestamp || !args.signingSecret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAge = args.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  if (Math.abs(now - ts) > maxAge) return false;

  const expected = signSlackRequest({
    signingSecret: args.signingSecret,
    timestamp,
    rawBody: args.rawBody,
  });

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Build `v0=<hex>` signature for tests or outbound verification helpers. */
export function signSlackRequest(args: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
}): string {
  const base = `v0:${args.timestamp}:${args.rawBody}`;
  const digest = createHmac("sha256", args.signingSecret)
    .update(base, "utf8")
    .digest("hex");
  return `v0=${digest}`;
}

export function readSlackSignatureHeaders(headers: Headers): {
  signature: string | null;
  timestamp: string | null;
} {
  return {
    signature: headers.get("x-slack-signature"),
    timestamp: headers.get("x-slack-request-timestamp"),
  };
}
