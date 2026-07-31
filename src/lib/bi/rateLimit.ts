import { rateLimit } from "@/lib/rate-limit";

import {
  buildBiQuotaHeaders,
  isUnlimitedQuota,
  nextUtcDayResetMs,
  nextUtcHourResetMs,
  resolveBiQuotaLimits,
  type BiKeyQuotaOverrides,
  type BiQuotaLimits,
} from "./quota";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type BiQuotaCheckResult =
  | {
      ok: true;
      limits: BiQuotaLimits;
      usedHour: number;
      usedDay: number;
      remainingHour: number | null;
      remainingDay: number | null;
      resetHourMs: number;
      resetDayMs: number;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      limits: BiQuotaLimits;
      usedHour: number;
      usedDay: number;
      remainingHour: number | null;
      remainingDay: number | null;
      resetHourMs: number;
      resetDayMs: number;
      retryAfterSec: number;
      window: "hour" | "day";
      headers: Record<string, string>;
    };

export type CheckBiQuotaInput = {
  keyId: string;
  plan: string | null | undefined;
  overrides?: BiKeyQuotaOverrides | null;
};

/**
 * Enforce plan-tier hour + day quotas via Upstash (or memory fallback).
 * Consultant / unlimited skips counters.
 */
export async function checkBiQuota(
  input: CheckBiQuotaInput,
): Promise<BiQuotaCheckResult> {
  const limits = resolveBiQuotaLimits(input.plan, input.overrides);
  const resetHourMs = nextUtcHourResetMs();
  const resetDayMs = nextUtcDayResetMs();

  if (isUnlimitedQuota(limits)) {
    return {
      ok: true,
      limits,
      usedHour: 0,
      usedDay: 0,
      remainingHour: null,
      remainingDay: null,
      resetHourMs,
      resetDayMs,
      headers: buildBiQuotaHeaders({
        limitPerHour: null,
        remainingHour: null,
        resetHourMs,
        limitPerDay: null,
        remainingDay: null,
        resetDayMs,
      }),
    };
  }

  let remainingHour: number | null = limits.perHour == null ? null : limits.perHour;
  let remainingDay: number | null = limits.perDay == null ? null : limits.perDay;
  let usedHour = 0;
  let usedDay = 0;
  let hourReset = resetHourMs;
  let dayReset = resetDayMs;

  if (limits.perHour != null) {
    const hour = await rateLimit(`bi:quota:hour:${input.keyId}`, {
      max: limits.perHour,
      windowMs: HOUR_MS,
    });
    remainingHour = hour.remaining;
    usedHour = Math.max(0, limits.perHour - hour.remaining);
    hourReset = hour.resetAtMs;
    if (!hour.ok) {
      const headers = buildBiQuotaHeaders({
        limitPerHour: limits.perHour,
        remainingHour: 0,
        resetHourMs: hourReset,
        limitPerDay: limits.perDay,
        remainingDay,
        resetDayMs: dayReset,
        retryAfterSec: hour.retryAfterSec,
      });
      return {
        ok: false,
        limits,
        usedHour: limits.perHour,
        usedDay,
        remainingHour: 0,
        remainingDay,
        resetHourMs: hourReset,
        resetDayMs: dayReset,
        retryAfterSec: hour.retryAfterSec,
        window: "hour",
        headers,
      };
    }
  }

  if (limits.perDay != null) {
    const day = await rateLimit(`bi:quota:day:${input.keyId}`, {
      max: limits.perDay,
      windowMs: DAY_MS,
    });
    remainingDay = day.remaining;
    usedDay = Math.max(0, limits.perDay - day.remaining);
    dayReset = day.resetAtMs;
    if (!day.ok) {
      const headers = buildBiQuotaHeaders({
        limitPerHour: limits.perHour,
        remainingHour,
        resetHourMs: hourReset,
        limitPerDay: limits.perDay,
        remainingDay: 0,
        resetDayMs: dayReset,
        retryAfterSec: day.retryAfterSec,
      });
      return {
        ok: false,
        limits,
        usedHour,
        usedDay: limits.perDay,
        remainingHour,
        remainingDay: 0,
        resetHourMs: hourReset,
        resetDayMs: dayReset,
        retryAfterSec: day.retryAfterSec,
        window: "day",
        headers,
      };
    }
  }

  return {
    ok: true,
    limits,
    usedHour,
    usedDay,
    remainingHour,
    remainingDay,
    resetHourMs: hourReset,
    resetDayMs: dayReset,
    headers: buildBiQuotaHeaders({
      limitPerHour: limits.perHour,
      remainingHour,
      resetHourMs: hourReset,
      limitPerDay: limits.perDay,
      remainingDay,
      resetDayMs: dayReset,
    }),
  };
}

/** @deprecated Prefer checkBiQuota — kept for callers that only have a key id. */
export async function checkBiRateLimit(
  keyId: string,
): Promise<{ ok: true; remaining: number } | { ok: false; retryAfterSec: number }> {
  const result = await checkBiQuota({ keyId, plan: "free" });
  if (!result.ok) {
    return { ok: false, retryAfterSec: result.retryAfterSec };
  }
  return {
    ok: true,
    remaining: result.remainingHour ?? result.remainingDay ?? 0,
  };
}

export function getBiRateLimitHeaders(
  result: { ok: true; remaining: number } | { ok: false; retryAfterSec: number },
): Record<string, string> {
  if (result.ok) {
    return buildBiQuotaHeaders({
      limitPerHour: 10,
      remainingHour: result.remaining,
      resetHourMs: nextUtcHourResetMs(),
      limitPerDay: 100,
      remainingDay: null,
      resetDayMs: nextUtcDayResetMs(),
    });
  }
  return buildBiQuotaHeaders({
    limitPerHour: 10,
    remainingHour: 0,
    resetHourMs: nextUtcHourResetMs(),
    limitPerDay: 100,
    remainingDay: 0,
    resetDayMs: nextUtcDayResetMs(),
    retryAfterSec: result.retryAfterSec,
  });
}

export { HOUR_MS, DAY_MS };
