/**
 * Pure 5-field cron expression matcher: minute hour day month weekday.
 * No dependencies. Supports wildcards, numbers, lists ("1,2"), ranges ("1-5"),
 * and step values (e.g. star-slash-5, or "1-10" stepped by 2).
 * Matching is evaluated in UTC (Vercel cron runs UTC).
 *
 * Standard cron day/weekday semantics: when both day-of-month and
 * day-of-week are restricted (not a wildcard), a match on either field is
 * enough (OR). When only one is restricted, that field alone must match.
 */

type FieldRange = { min: number; max: number };

const MINUTE: FieldRange = { min: 0, max: 59 };
const HOUR: FieldRange = { min: 0, max: 23 };
const DAY_OF_MONTH: FieldRange = { min: 1, max: 31 };
const MONTH: FieldRange = { min: 1, max: 12 };
const WEEKDAY: FieldRange = { min: 0, max: 7 };

function parsePart(part: string, range: FieldRange): number[] {
  const [rangePart, stepPart] = part.split("/");
  let step = 1;
  if (stepPart !== undefined) {
    step = Number(stepPart);
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid cron step: '${part}'`);
    }
  }

  let start = range.min;
  let end = range.max;

  if (rangePart !== "*") {
    if (rangePart.includes("-")) {
      const [rawStart, rawEnd] = rangePart.split("-");
      const a = Number(rawStart);
      const b = Number(rawEnd);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a > b) {
        throw new Error(`Invalid cron range: '${part}'`);
      }
      start = a;
      end = b;
    } else {
      const n = Number(rangePart);
      if (!Number.isInteger(n)) {
        throw new Error(`Invalid cron value: '${part}'`);
      }
      start = n;
      end = stepPart !== undefined ? range.max : n;
    }
  }

  if (start < range.min || end > range.max) {
    throw new Error(`Cron value out of range: '${part}'`);
  }

  const values: number[] = [];
  for (let v = start; v <= end; v += step) {
    values.push(v);
  }
  return values;
}

function parseField(field: string, range: FieldRange): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) throw new Error("Empty cron field segment");
    for (const v of parsePart(trimmed, range)) {
      values.add(v);
    }
  }
  return values;
}

/**
 * Returns true when `date` (evaluated in UTC) matches the 5-field cron
 * `expression`. Returns false (never throws) on malformed expressions.
 */
export function cronMatches(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields;

  try {
    const minutes = parseField(minuteField, MINUTE);
    const hours = parseField(hourField, HOUR);
    const days = parseField(dayField, DAY_OF_MONTH);
    const months = parseField(monthField, MONTH);
    const weekdaysRaw = parseField(weekdayField, WEEKDAY);
    const weekdays = new Set<number>();
    for (const w of weekdaysRaw) weekdays.add(w === 7 ? 0 : w);

    if (!minutes.has(date.getUTCMinutes())) return false;
    if (!hours.has(date.getUTCHours())) return false;
    if (!months.has(date.getUTCMonth() + 1)) return false;

    const dayRestricted = dayField.trim() !== "*";
    const weekdayRestricted = weekdayField.trim() !== "*";
    const dayMatches = days.has(date.getUTCDate());
    const weekdayMatches = weekdays.has(date.getUTCDay());

    if (dayRestricted && weekdayRestricted) {
      return dayMatches || weekdayMatches;
    }
    if (dayRestricted) return dayMatches;
    if (weekdayRestricted) return weekdayMatches;
    return true;
  } catch {
    return false;
  }
}

/**
 * True when `lastRunAt` falls in the same calendar minute (UTC) as `now`.
 * Used to debounce schedule automations so a cron tick never double-runs
 * a rule it already ran in the current minute.
 */
export function sameCronMinute(
  lastRunAt: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!lastRunAt) return false;
  const last = lastRunAt instanceof Date ? lastRunAt : new Date(lastRunAt);
  if (Number.isNaN(last.getTime())) return false;
  return Math.floor(last.getTime() / 60000) === Math.floor(now.getTime() / 60000);
}
