/**
 * Common cache headers for different types of endpoints.
 * Use these to ensure consistent caching across the API.
 */

export const CACHE_HEADERS = {
  // Frequently accessed, rarely changes (plans, factors, config)
  STATIC: {
    "Cache-Control": "public, max-age=3600, s-maxage=3600", // 1 hour
    "CDN-Cache-Control": "max-age=3600",
    Vary: "Authorization",
  },

  // Changes hourly or less frequently (reports, statistics)
  MEDIUM: {
    "Cache-Control": "public, max-age=600, s-maxage=600", // 10 minutes
    "CDN-Cache-Control": "max-age=600",
    Vary: "Authorization",
  },

  // Real-time or frequently updated (usage, subscriptions, quotas)
  MINIMAL: {
    "Cache-Control": "private, max-age=60, must-revalidate", // 1 minute, auth-required
    Vary: "Authorization",
  },

  // Never cache (user-specific, live data)
  NONE: {
    "Cache-Control": "private, no-cache, no-store, must-revalidate",
    Vary: "Authorization",
  },

  // Long-term cache for immutable resources (downloads, PDFs)
  IMMUTABLE: {
    "Cache-Control": "public, max-age=31536000, immutable", // 1 year
  },
};

export type CacheStrategy = keyof typeof CACHE_HEADERS;
