import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "bi_";

export function generateBiApiKey(): {
  apiKey: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
} {
  const secret = randomBytes(24).toString("base64url");
  const apiKey = `${KEY_PREFIX}${secret}`;
  return {
    apiKey,
    apiKeyHash: hashBiApiKey(apiKey),
    apiKeyPrefix: apiKey.slice(0, 12),
  };
}

export function hashBiApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey.trim()).digest("hex");
}

export function verifyBiApiKey(
  provided: string | null | undefined,
  storedHash: string | null | undefined,
): boolean {
  if (!provided || !storedHash) return false;
  const providedHash = hashBiApiKey(provided);
  if (providedHash.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

/** Extract BI API key from Authorization Bearer or X-ClearESG-Api-Key. */
export function extractBiApiKey(headers: Headers): string | null {
  const dedicated = headers.get("x-clearesg-api-key");
  if (dedicated?.trim()) return dedicated.trim();

  const auth = headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}
