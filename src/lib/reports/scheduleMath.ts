/**
 * Pure schedule math for report delivery.
 * All nextRunAt values are UTC instants; timezone is only used to interpret local wall time.
 */

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export type ScheduleSpec = {
  frequency: ScheduleFrequency;
  /** Local wall-clock time HH:mm (24h) in `timezone` */
  time: string;
  /** IANA timezone (e.g. Europe/London) */
  timezone: string;
  /** ISO weekday 1=Mon … 7=Sun; required for weekly */
  dayOfWeek?: number;
  /** Calendar day 1–31; required for monthly (clamped to month length) */
  dayOfMonth?: number;
};

export const MAX_SCHEDULE_RETRIES = 3;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidTimeHhMm(value: string): boolean {
  return TIME_RE.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function parseTimeHhMm(time: string): { hour: number; minute: number } {
  if (!isValidTimeHhMm(time)) {
    throw new Error(`Invalid time "${time}". Use HH:mm (24h).`);
  }
  const [h, m] = time.split(":");
  return { hour: Number(h), minute: Number(m) };
}

export function normalizeRecipients(recipients: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of recipients) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (!isValidEmail(email)) {
      throw new Error(`Invalid recipient email: ${raw}`);
    }
    seen.add(email);
    out.push(email);
  }
  if (out.length === 0) {
    throw new Error("At least one recipient email is required");
  }
  return out;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday 1=Mon … 7=Sun */
  weekday: number;
};

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function assertValidTimezone(timeZone: string): void {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone: ${timeZone}`);
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hourRaw = Number(bag.hour);
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: WEEKDAY_TO_ISO[bag.weekday] ?? 1,
  };
}

/** Offset of `timeZone` at `date`: (wall-as-UTC ms) − (actual UTC ms). */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Convert a wall-clock local datetime in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  assertValidTimezone(timeZone);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset1 = getTimeZoneOffsetMs(new Date(guess), timeZone);
  const utc1 = guess - offset1;
  const offset2 = getTimeZoneOffsetMs(new Date(utc1), timeZone);
  return new Date(guess - offset2);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function candidateAtLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  return zonedLocalToUtc(year, month, day, hour, minute, timeZone);
}

/**
 * Next UTC run strictly after `from` (default: now) for the given local schedule.
 */
export function computeNextRunAt(spec: ScheduleSpec, from: Date = new Date()): Date {
  assertValidTimezone(spec.timezone);
  const { hour, minute } = parseTimeHhMm(spec.time);
  const nowParts = getZonedParts(from, spec.timezone);

  if (spec.frequency === "daily") {
    let cand = candidateAtLocalTime(
      nowParts.year,
      nowParts.month,
      nowParts.day,
      hour,
      minute,
      spec.timezone,
    );
    if (cand.getTime() <= from.getTime()) {
      const next = addCalendarDays(nowParts.year, nowParts.month, nowParts.day, 1);
      cand = candidateAtLocalTime(
        next.year,
        next.month,
        next.day,
        hour,
        minute,
        spec.timezone,
      );
    }
    return cand;
  }

  if (spec.frequency === "weekly") {
    const targetDow = spec.dayOfWeek ?? 1;
    if (targetDow < 1 || targetDow > 7) {
      throw new Error("dayOfWeek must be 1 (Mon) through 7 (Sun)");
    }
    const delta = (targetDow - nowParts.weekday + 7) % 7;
    let day = addCalendarDays(nowParts.year, nowParts.month, nowParts.day, delta);
    let cand = candidateAtLocalTime(
      day.year,
      day.month,
      day.day,
      hour,
      minute,
      spec.timezone,
    );
    if (cand.getTime() <= from.getTime()) {
      day = addCalendarDays(day.year, day.month, day.day, 7);
      cand = candidateAtLocalTime(
        day.year,
        day.month,
        day.day,
        hour,
        minute,
        spec.timezone,
      );
    }
    return cand;
  }

  // monthly
  const targetDom = spec.dayOfMonth ?? 1;
  if (targetDom < 1 || targetDom > 31) {
    throw new Error("dayOfMonth must be 1 through 31");
  }

  const tryMonth = (year: number, month: number): Date => {
    const dom = Math.min(targetDom, daysInMonth(year, month));
    return candidateAtLocalTime(year, month, dom, hour, minute, spec.timezone);
  };

  let cand = tryMonth(nowParts.year, nowParts.month);
  if (cand.getTime() <= from.getTime()) {
    const nextMonth = nowParts.month === 12 ? 1 : nowParts.month + 1;
    const nextYear = nowParts.month === 12 ? nowParts.year + 1 : nowParts.year;
    cand = tryMonth(nextYear, nextMonth);
  }
  return cand;
}

/**
 * Exponential backoff after failure. retryCount is 1-based attempt after first fail.
 * 1 → 5m, 2 → 10m, 3 → 20m.
 */
export function computeRetryDelayMs(retryCount: number): number {
  const n = Math.max(1, Math.min(retryCount, MAX_SCHEDULE_RETRIES));
  return Math.pow(2, n - 1) * 5 * 60 * 1000;
}

export function computeRetryAt(retryCount: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + computeRetryDelayMs(retryCount));
}

/**
 * Idempotency: skip if this dueRunAt was already delivered successfully.
 */
export function shouldSkipDuplicateDelivery(
  lastDeliveredForRunAt: string | null | undefined,
  dueRunAt: string,
): boolean {
  return Boolean(lastDeliveredForRunAt) && lastDeliveredForRunAt === dueRunAt;
}

/** Claim is still held by another worker (default 10 minutes). */
export function isClaimActive(
  claimedAt: string | null | undefined,
  now: Date = new Date(),
  ttlMs = 10 * 60 * 1000,
): boolean {
  if (!claimedAt) return false;
  const t = new Date(claimedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < ttlMs;
}

export function validateScheduleSpec(spec: ScheduleSpec): void {
  parseTimeHhMm(spec.time);
  assertValidTimezone(spec.timezone);
  if (spec.frequency === "weekly") {
    const dow = spec.dayOfWeek ?? 1;
    if (dow < 1 || dow > 7) {
      throw new Error("dayOfWeek must be 1 (Mon) through 7 (Sun)");
    }
  }
  if (spec.frequency === "monthly") {
    const dom = spec.dayOfMonth ?? 1;
    if (dom < 1 || dom > 31) {
      throw new Error("dayOfMonth must be 1 through 31");
    }
  }
}
