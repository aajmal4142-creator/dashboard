import { describe, expect, it } from "vitest";

import { clearMemoryRateLimits, rateLimit } from "./index";

describe("rateLimit memory backend", () => {
  it("allows then blocks after max", async () => {
    clearMemoryRateLimits();
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(key, { max: 3, windowMs: 60_000 });
      expect(r.ok).toBe(true);
    }
    const blocked = await rateLimit(key, { max: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
