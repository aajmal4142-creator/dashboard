import { randomBytes } from "node:crypto";

import { REQUEST_TTL_DAYS } from "./fields";

export function newRequestToken(): string {
  return randomBytes(24).toString("base64url");
}

export function requestExpiryFrom(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + REQUEST_TTL_DAYS);
  return d;
}

export function isTokenExpired(
  expiresAt: string | Date | null | undefined,
  now = new Date(),
): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return t.getTime() < now.getTime();
}
