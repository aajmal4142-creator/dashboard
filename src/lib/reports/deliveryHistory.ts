/**
 * Pure helpers for scheduled-report delivery history + recipient list state.
 */

export type DeliveryRecipientStatus = "sent" | "failed" | "skipped";

export type DeliveryHistoryEntry = {
  runAt: string;
  sentAt: string;
  email: string;
  status: DeliveryRecipientStatus;
  error: string | null;
  trackingId?: string | null;
  openCount?: number;
  openedAt?: string | null;
  providerMessageId?: string | null;
};

export type ScheduleRecipient = {
  email: string;
  unsubscribed: boolean;
  unsubscribedAt: string | null;
};

export const MAX_DELIVERY_HISTORY = 100;

export function normalizeScheduleRecipients(
  recipients: Array<{
    email: string;
    unsubscribed?: boolean | null;
    unsubscribedAt?: string | null;
  }>,
): ScheduleRecipient[] {
  const seen = new Set<string>();
  const out: ScheduleRecipient[] = [];
  for (const row of recipients) {
    const email = row.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      unsubscribed: Boolean(row.unsubscribed),
      unsubscribedAt: row.unsubscribedAt ? String(row.unsubscribedAt) : null,
    });
  }
  return out;
}

/** Active (still subscribed) emails only. */
export function activeRecipientEmails(recipients: ScheduleRecipient[]): string[] {
  return recipients.filter((r) => !r.unsubscribed).map((r) => r.email);
}

export function markRecipientUnsubscribed(
  recipients: ScheduleRecipient[],
  email: string,
  at: Date = new Date(),
): ScheduleRecipient[] {
  const target = email.trim().toLowerCase();
  let found = false;
  const next = recipients.map((r) => {
    if (r.email !== target) return r;
    found = true;
    return {
      ...r,
      unsubscribed: true,
      unsubscribedAt: at.toISOString(),
    };
  });
  if (!found) {
    throw new Error("Recipient not found on this schedule");
  }
  return next;
}

/**
 * Prepend new entries and cap length (newest first).
 */
export function appendDeliveryHistory(
  existing: DeliveryHistoryEntry[],
  entries: DeliveryHistoryEntry[],
  max = MAX_DELIVERY_HISTORY,
): DeliveryHistoryEntry[] {
  if (entries.length === 0) return existing.slice(0, max);
  return [...entries, ...existing].slice(0, max);
}

export function buildDeliveryEntries(input: {
  runAt: string;
  sentAt: string;
  results: Array<{
    email: string;
    status: DeliveryRecipientStatus;
    error?: string | null;
    trackingId?: string | null;
    providerMessageId?: string | null;
  }>;
}): DeliveryHistoryEntry[] {
  return input.results.map((r) => ({
    runAt: input.runAt,
    sentAt: input.sentAt,
    email: r.email.trim().toLowerCase(),
    status: r.status,
    error: r.error ? r.error.slice(0, 500) : null,
    trackingId: r.trackingId ?? null,
    openCount: 0,
    openedAt: null,
    providerMessageId: r.providerMessageId ?? null,
  }));
}

/**
 * Increment open tracking on a matching deliveryHistory row (by trackingId).
 * Returns null if no match.
 */
export function recordDeliveryOpen(
  existing: DeliveryHistoryEntry[],
  trackingId: string,
  at: Date = new Date(),
): DeliveryHistoryEntry[] | null {
  const id = trackingId.trim();
  if (!id) return null;
  let found = false;
  const next = existing.map((row) => {
    if (row.trackingId !== id) return row;
    found = true;
    const openCount = (row.openCount ?? 0) + 1;
    return {
      ...row,
      openCount,
      openedAt: row.openedAt ?? at.toISOString(),
    };
  });
  return found ? next : null;
}

/**
 * Aggregate one run's per-recipient outcomes into schedule lastStatus.
 * All skipped (e.g. all unsubscribed) → skipped; any fail → failed; else success.
 */
export function summarizeDeliveryRun(
  results: Array<{ status: DeliveryRecipientStatus }>,
): "success" | "failed" | "skipped" {
  if (results.length === 0) return "skipped";
  if (results.every((r) => r.status === "skipped")) return "skipped";
  if (results.some((r) => r.status === "failed")) return "failed";
  return "success";
}

export function mapDeliveryHistoryRows(raw: unknown): DeliveryHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    const status = r.status;
    if (!email || (status !== "sent" && status !== "failed" && status !== "skipped")) {
      continue;
    }
    out.push({
      runAt: r.runAt ? String(r.runAt) : "",
      sentAt: r.sentAt ? String(r.sentAt) : "",
      email,
      status,
      error: typeof r.error === "string" ? r.error : null,
      trackingId: typeof r.trackingId === "string" ? r.trackingId : null,
      openCount: typeof r.openCount === "number" ? r.openCount : 0,
      openedAt: r.openedAt ? String(r.openedAt) : null,
      providerMessageId:
        typeof r.providerMessageId === "string" ? r.providerMessageId : null,
    });
  }
  return out;
}
