import { rateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_PER_KEY = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type BiRateLimitResult =
  { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

export async function checkBiRateLimit(keyId: string): Promise<BiRateLimitResult> {
  const key = `bi:key:${keyId}`;
  const result = await rateLimit(key, {
    max: RATE_LIMIT_PER_KEY,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!result.ok) {
    return { ok: false, retryAfterSec: result.retryAfterSec };
  }

  return { ok: true, remaining: RATE_LIMIT_PER_KEY - 1 };
}

export function getBiRateLimitHeaders(result: BiRateLimitResult): Record<string, string> {
  if (result.ok) {
    return {
      "X-RateLimit-Limit": String(RATE_LIMIT_PER_KEY),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
    };
  }

  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_PER_KEY),
    "X-RateLimit-Remaining": "0",
    "Retry-After": String(result.retryAfterSec),
  };
}

export { RATE_LIMIT_PER_KEY, RATE_LIMIT_WINDOW_MS };
