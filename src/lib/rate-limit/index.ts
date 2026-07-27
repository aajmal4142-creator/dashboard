import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

type Bucket = { timestamps: number[] };
const memoryBuckets = new Map<string, Bucket>();

function memoryLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): LimitResult {
  const bucket = memoryBuckets.get(key) ?? { timestamps: [] };
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t >= cutoff);
  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0] ?? now;
    memoryBuckets.set(key, bucket);
    return { ok: false, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  bucket.timestamps.push(now);
  memoryBuckets.set(key, bucket);
  return { ok: true };
}

let upstash: Ratelimit | null = null;

function getUpstash(
  max: number,
  window: `${number} s` | `${number} m` | `${number} h`,
): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  // One limiter instance per max/window pair is ideal; for simplicity recreate is ok for low traffic.
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: "clearesg",
  });
}

/**
 * Rate limit public endpoints. Uses Upstash when configured; otherwise in-memory.
 */
export async function rateLimit(
  key: string,
  opts: { max: number; windowMs: number } = { max: 30, windowMs: 60_000 },
): Promise<LimitResult> {
  const windowSec = Math.max(1, Math.ceil(opts.windowMs / 1000));
  const window =
    windowSec >= 3600
      ? (`${Math.ceil(windowSec / 3600)} h` as const)
      : windowSec >= 60
        ? (`${Math.ceil(windowSec / 60)} m` as const)
        : (`${windowSec} s` as const);

  try {
    const limiter = getUpstash(opts.max, window);
    if (limiter) {
      upstash = limiter;
      const res = await upstash.limit(key);
      if (res.success) return { ok: true };
      const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return { ok: false, retryAfterSec };
    }
  } catch (err) {
    console.error("Upstash rate limit failed; falling back to memory", err);
  }

  return memoryLimit(key, opts.max, opts.windowMs);
}

export function clearMemoryRateLimits(): void {
  memoryBuckets.clear();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}
