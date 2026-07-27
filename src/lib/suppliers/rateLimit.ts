import { rateLimit } from "@/lib/rate-limit";

/**
 * Hard rate limit for public supplier form endpoints.
 * Upstash when configured; otherwise in-memory.
 */
export async function assertRateLimit(
  key: string,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  return rateLimit(key, { max: 12, windowMs: 60 * 60 * 1000 });
}

/** @deprecated use clearMemoryRateLimits from @/lib/rate-limit */
export { clearMemoryRateLimits as clearRateLimits } from "@/lib/rate-limit";
