import { rateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_PER_ORG = 1000; // requests
const RATE_LIMIT_WINDOW_MS = 3600_000; // 1 hour

export type RateLimitResult =
  | {
      ok: true;
      remaining: number;
    }
  | {
      ok: false;
      retryAfterSec: number;
    };

export async function checkOrgRateLimit(organisationId: string): Promise<RateLimitResult> {
  const key = `webhook:org:${organisationId}`;
  const result = await rateLimit(key, {
    max: RATE_LIMIT_PER_ORG,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!result.ok) {
    return {
      ok: false,
      retryAfterSec: result.retryAfterSec,
    };
  }

  // Calculate remaining (approximate)
  const remaining = RATE_LIMIT_PER_ORG - 1;
  return {
    ok: true,
    remaining,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  if (result.ok) {
    return {
      "X-RateLimit-Limit": String(RATE_LIMIT_PER_ORG),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
    };
  }

  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_PER_ORG),
    "X-RateLimit-Remaining": "0",
    "Retry-After": String(result.retryAfterSec),
  };
}
