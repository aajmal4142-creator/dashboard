import type { PlanId } from "@/lib/billing/plans";
import { normalizePlan } from "@/lib/billing/plans";

/** Sprint F15 tiers mapped onto org plans free / pro / consultant. */
export type BiQuotaLimits = {
  perHour: number | null;
  perDay: number | null;
};

export const BI_PLAN_QUOTAS: Record<PlanId, BiQuotaLimits> = {
  free: { perHour: 10, perDay: 100 },
  pro: { perHour: 500, perDay: 10_000 },
  /** Consultant maps to enterprise — unlimited. */
  consultant: { perHour: null, perDay: null },
};

export const BI_QUOTA_WARNING_PERCENT = 80;

export type BiKeyQuotaOverrides = {
  quotaLimitPerHour?: number | null;
  quotaLimitPerDay?: number | null;
};

/**
 * Resolve effective hour/day limits: key overrides win when set (> 0);
 * otherwise plan defaults. null = unlimited.
 */
export function resolveBiQuotaLimits(
  plan: string | null | undefined,
  overrides?: BiKeyQuotaOverrides | null,
): BiQuotaLimits {
  const base = BI_PLAN_QUOTAS[normalizePlan(plan)];
  const hour =
    overrides?.quotaLimitPerHour != null && overrides.quotaLimitPerHour > 0
      ? overrides.quotaLimitPerHour
      : base.perHour;
  const day =
    overrides?.quotaLimitPerDay != null && overrides.quotaLimitPerDay > 0
      ? overrides.quotaLimitPerDay
      : base.perDay;
  return { perHour: hour, perDay: day };
}

export function isUnlimitedQuota(limits: BiQuotaLimits): boolean {
  return limits.perHour == null && limits.perDay == null;
}

/** Empty / missing whitelist means all IPs allowed. */
export function isIpAllowed(
  clientIpAddr: string,
  allowedIps: string[] | null | undefined,
): boolean {
  if (!allowedIps || allowedIps.length === 0) return true;
  const normalized = clientIpAddr.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return false;
  return allowedIps.some((entry) => entry.trim().toLowerCase() === normalized);
}

export function quotaPercentageUsed(used: number, limit: number | null): number {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, used) / limit) * 100));
}

export function shouldAlertApproachingQuota(
  used: number,
  limit: number | null,
  warningPercent: number = BI_QUOTA_WARNING_PERCENT,
): boolean {
  if (limit == null || limit <= 0) return false;
  return quotaPercentageUsed(used, limit) >= warningPercent;
}

export function remainingFromUsed(used: number, limit: number | null): number | null {
  if (limit == null) return null;
  return Math.max(0, limit - Math.max(0, used));
}

export function nextUtcDayResetMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function nextUtcHourResetMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours() + 1,
  );
}

export type BiQuotaHeaderInput = {
  limitPerHour: number | null;
  remainingHour: number | null;
  resetHourMs: number;
  limitPerDay: number | null;
  remainingDay: number | null;
  resetDayMs: number;
  retryAfterSec?: number;
};

/**
 * Primary RateLimit-* headers reflect the tighter window (hour when capped).
 * Day counters are exposed as X-Quota-*-Day.
 */
export function buildBiQuotaHeaders(input: BiQuotaHeaderInput): Record<string, string> {
  const headers: Record<string, string> = {};

  if (input.limitPerHour != null) {
    headers["X-RateLimit-Limit"] = String(input.limitPerHour);
    headers["X-RateLimit-Remaining"] = String(
      input.remainingHour == null ? 0 : Math.max(0, input.remainingHour),
    );
    headers["X-RateLimit-Reset"] = String(Math.floor(input.resetHourMs / 1000));
  } else if (input.limitPerDay != null) {
    headers["X-RateLimit-Limit"] = String(input.limitPerDay);
    headers["X-RateLimit-Remaining"] = String(
      input.remainingDay == null ? 0 : Math.max(0, input.remainingDay),
    );
    headers["X-RateLimit-Reset"] = String(Math.floor(input.resetDayMs / 1000));
  } else {
    headers["X-RateLimit-Limit"] = "unlimited";
    headers["X-RateLimit-Remaining"] = "unlimited";
    headers["X-RateLimit-Reset"] = String(Math.floor(input.resetDayMs / 1000));
  }

  if (input.limitPerDay != null) {
    headers["X-Quota-Limit-Day"] = String(input.limitPerDay);
    headers["X-Quota-Remaining-Day"] = String(
      input.remainingDay == null ? 0 : Math.max(0, input.remainingDay),
    );
    headers["X-Quota-Reset-Day"] = String(Math.floor(input.resetDayMs / 1000));
  }

  if (input.limitPerHour != null) {
    headers["X-Quota-Limit-Hour"] = String(input.limitPerHour);
    headers["X-Quota-Remaining-Hour"] = String(
      input.remainingHour == null ? 0 : Math.max(0, input.remainingHour),
    );
    headers["X-Quota-Reset-Hour"] = String(Math.floor(input.resetHourMs / 1000));
  }

  if (input.retryAfterSec != null && input.retryAfterSec > 0) {
    headers["Retry-After"] = String(input.retryAfterSec);
  }

  return headers;
}

export function parseAllowedIps(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ips: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) ips.push(trimmed);
    } else if (
      entry &&
      typeof entry === "object" &&
      "ip" in entry &&
      typeof (entry as { ip: unknown }).ip === "string"
    ) {
      const trimmed = (entry as { ip: string }).ip.trim();
      if (trimmed) ips.push(trimmed);
    }
  }
  return ips.length > 0 ? ips : null;
}
