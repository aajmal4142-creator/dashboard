/**
 * HMAC-signed unsubscribe tokens for scheduled report emails.
 * Pure crypto helpers — no I/O.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type UnsubscribePayload = {
  scheduleId: string;
  email: string;
};

const TOKEN_VERSION = "v1";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(value: string): Buffer | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + pad, "base64");
  } catch {
    return null;
  }
}

function signBody(body: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(body, "utf8").digest());
}

/**
 * Encode scheduleId + email into a URL-safe token.
 * Payload is JSON (emails contain `.`) so the wire format stays unambiguous.
 */
export function createUnsubscribeToken(
  payload: UnsubscribePayload,
  secret: string,
): string {
  const scheduleId = payload.scheduleId.trim();
  const email = payload.email.trim().toLowerCase();
  if (!scheduleId || !email || !secret) {
    throw new Error("scheduleId, email, and secret are required");
  }
  const body = JSON.stringify({
    v: TOKEN_VERSION,
    s: scheduleId,
    e: email,
  });
  const sig = signBody(body, secret);
  return `${b64url(Buffer.from(body, "utf8"))}.${sig}`;
}

/**
 * Verify token; returns null on any failure (tamper, bad format, empty secret).
 */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): UnsubscribePayload | null {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const bodyB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!bodyB64 || !sig) return null;

  const bodyBuf = fromB64url(bodyB64);
  if (!bodyBuf) return null;
  const body = bodyBuf.toString("utf8");
  const expected = signBody(body, secret);

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as {
      v?: unknown;
      s?: unknown;
      e?: unknown;
    };
    if (parsed.v !== TOKEN_VERSION) return null;
    if (typeof parsed.s !== "string" || typeof parsed.e !== "string") return null;
    const scheduleId = parsed.s.trim();
    const email = parsed.e.trim().toLowerCase();
    if (!scheduleId || !email) return null;
    return { scheduleId, email };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(input: { baseUrl: string; token: string }): string {
  const base = input.baseUrl.replace(/\/$/, "");
  return `${base}/unsubscribe/report?token=${encodeURIComponent(input.token)}`;
}

export function unsubscribeSigningSecret(): string {
  return (
    process.env.REPORT_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.PAYLOAD_SECRET?.trim() ||
    ""
  );
}
