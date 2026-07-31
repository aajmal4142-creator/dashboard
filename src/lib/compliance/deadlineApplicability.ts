/**
 * Pure helpers for regulatory deadline applicability and urgency.
 * Zero I/O. Uses obligations rules for EU / large-undertaking proxies.
 */

import {
  EU_OPERATING_COUNTRIES,
  isLikelyLargeUndertaking,
} from "@/lib/obligations/rules";
import type { RevenueBand } from "@/lib/obligations/types";

export type DeadlineScope = "all" | "industry" | "size" | "country";

export type DeadlineApplicabilityRule = {
  appliesTo: DeadlineScope;
  countries?: ReadonlyArray<{ code: string } | string> | null;
  industries?: ReadonlyArray<{ nacePrefix: string } | string> | null;
  minEmployeeCount?: number | null;
  maxEmployeeCount?: number | null;
  revenueBands?: ReadonlyArray<string> | null;
  euOperatingOnly?: boolean | null;
  requireLargeUndertaking?: boolean | null;
};

export type OrgDeadlineProfile = {
  country: string;
  sector: string;
  employeeCount: number | null;
  revenueBand: RevenueBand | null;
};

export const URGENT_DAYS_THRESHOLD = 30;
export const UPCOMING_WINDOW_DAYS = 90;

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function countryCodes(countries: DeadlineApplicabilityRule["countries"]): string[] {
  if (!countries) return [];
  return countries
    .map((c) => (typeof c === "string" ? c : c.code))
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .map(normalizeCode);
}

function nacePrefixes(industries: DeadlineApplicabilityRule["industries"]): string[] {
  if (!industries) return [];
  return industries
    .map((i) => (typeof i === "string" ? i : i.nacePrefix))
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => p.trim().toUpperCase());
}

function sectorMatchesPrefix(sector: string, prefix: string): boolean {
  const s = sector.trim().toUpperCase();
  const p = prefix.trim().toUpperCase();
  if (!s || !p) return false;
  return s === p || s.startsWith(p);
}

/**
 * Evaluate whether a catalog deadline applies to an organisation profile.
 * Defaults to applicable when rule is missing or appliesTo=all (with optional
 * EU / large-undertaking gates still honoured).
 */
export function isDeadlineApplicable(
  rule: DeadlineApplicabilityRule | null | undefined,
  org: OrgDeadlineProfile,
): boolean {
  const country = normalizeCode(org.country || "");
  const appliesTo = rule?.appliesTo ?? "all";

  if (rule?.euOperatingOnly) {
    if (!EU_OPERATING_COUNTRIES.has(country)) return false;
  }

  if (rule?.requireLargeUndertaking) {
    if (!isLikelyLargeUndertaking(org.employeeCount, org.revenueBand)) {
      return false;
    }
  }

  switch (appliesTo) {
    case "all":
      return true;

    case "country": {
      const codes = countryCodes(rule?.countries);
      if (codes.length === 0) return false;
      // GLOBAL / EU jurisdiction helpers: treat EU set as match when listed
      if (codes.includes("EU")) {
        return EU_OPERATING_COUNTRIES.has(country) || codes.includes(country);
      }
      if (codes.includes("GLOBAL")) return true;
      return codes.includes(country);
    }

    case "industry": {
      const prefixes = nacePrefixes(rule?.industries);
      if (prefixes.length === 0) return false;
      return prefixes.some((p) => sectorMatchesPrefix(org.sector, p));
    }

    case "size": {
      const min = rule?.minEmployeeCount ?? null;
      const max = rule?.maxEmployeeCount ?? null;
      const bands = rule?.revenueBands ?? null;
      const head = org.employeeCount;

      let sizeOk = true;
      if (min !== null || max !== null) {
        if (head === null) {
          sizeOk = false;
        } else {
          if (min !== null && head < min) sizeOk = false;
          if (max !== null && head > max) sizeOk = false;
        }
      }

      let bandOk = true;
      if (bands && bands.length > 0) {
        bandOk = org.revenueBand !== null && bands.includes(org.revenueBand);
      }

      // If neither employees nor bands constrained, fall back to large proxy
      if (min === null && max === null && (!bands || bands.length === 0)) {
        return isLikelyLargeUndertaking(org.employeeCount, org.revenueBand);
      }

      // When both present, either matching dimension is enough (OR) if one side unset;
      // when both sides are set, require both (AND).
      const hasHeadConstraint = min !== null || max !== null;
      const hasBandConstraint = Boolean(bands && bands.length > 0);
      if (hasHeadConstraint && hasBandConstraint) return sizeOk && bandOk;
      if (hasHeadConstraint) return sizeOk;
      return bandOk;
    }

    default:
      return false;
  }
}

/** UTC calendar-day difference: due − asOf. Negative = overdue. */
export function calculateDaysRemaining(
  dueDate: string,
  asOf: Date | string = new Date(),
): number {
  const due = parseUtcDay(dueDate);
  const now = typeof asOf === "string" ? parseUtcDay(asOf) : startOfUtcDay(asOf);
  const ms = due.getTime() - now.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function isUrgentDeadline(
  daysRemaining: number,
  threshold: number = URGENT_DAYS_THRESHOLD,
): boolean {
  return daysRemaining >= 0 && daysRemaining < threshold;
}

export function isWithinUpcomingWindow(
  daysRemaining: number,
  windowDays: number = UPCOMING_WINDOW_DAYS,
): boolean {
  return daysRemaining >= 0 && daysRemaining <= windowDays;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseUtcDay(iso: string): Date {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export type ApiDeadlineStatus = "pending" | "in-progress" | "completed" | "missed";

export type StoredDeadlineStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "missed"
  | "not_started"
  | "submitted"
  | "verified"
  | "overdue";

/** Map stored / legacy status → API contract status. */
export function toApiStatus(status: string): ApiDeadlineStatus {
  switch (status) {
    case "completed":
    case "submitted":
    case "verified":
      return "completed";
    case "in_progress":
    case "in-progress":
      return "in-progress";
    case "missed":
    case "overdue":
      return "missed";
    case "pending":
    case "not_started":
    default:
      return "pending";
  }
}

/** Map API status → stored select value. */
export function toStoredStatus(status: string): StoredDeadlineStatus {
  switch (status) {
    case "in-progress":
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "missed":
    case "overdue":
      return "missed";
    case "pending":
    case "not_started":
    default:
      return "pending";
  }
}

export function severityTokenClass(
  severity: "critical" | "high" | "medium" | string,
): "critical" | "high" | "medium" {
  if (severity === "critical" || severity === "high" || severity === "medium") {
    return severity;
  }
  return "medium";
}
