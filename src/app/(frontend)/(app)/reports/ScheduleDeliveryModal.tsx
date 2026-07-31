"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DeliveryHistoryRow = {
  runAt: string;
  sentAt: string;
  email: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  openCount?: number;
  openedAt?: string | null;
};

export type ScheduleRecipientDetail = {
  email: string;
  unsubscribed: boolean;
  unsubscribedAt: string | null;
};

export type ScheduleRow = {
  id: string;
  reportId: string;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  timezone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  recipients: string[];
  recipientDetails?: ScheduleRecipientDetail[];
  format: "pdf" | "csv" | "json" | "xml";
  status: "active" | "paused" | "completed";
  nextRunAt: string;
  lastRunAt: string | null;
  lastStatus: "success" | "failed" | "skipped" | null;
  lastError: string | null;
  retryCount: number;
  deliveryHistory?: DeliveryHistoryRow[];
};

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Calcutta",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function formatNextRun(iso: string): string {
  try {
    return new Date(iso)
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, " UTC");
  } catch {
    return iso;
  }
}

function formatRecipients(row: ScheduleRow): string {
  const details = row.recipientDetails;
  if (!details || details.length === 0) {
    return row.recipients.join(", ");
  }
  return details
    .map((r) => (r.unsubscribed ? `${r.email} (unsubscribed)` : r.email))
    .join(", ");
}

export function ScheduleDeliveryModal({
  open,
  onOpenChange,
  reportId,
  reportLabel,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportLabel: string;
  canEdit: boolean;
}) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const [recipients, setRecipients] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [time, setTime] = useState("08:00");
  const [timezone, setTimezone] = useState("Europe/London");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [format, setFormat] = useState<"pdf" | "csv" | "json" | "xml">("pdf");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/reports/${reportId}/schedules`);
        const data = (await res.json().catch(() => ({}))) as {
          schedules?: ScheduleRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load schedules");
          return;
        }
        setSchedules(data.schedules ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reportId]);

  async function loadSchedules() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/reports/${reportId}/schedules`);
      const data = (await res.json().catch(() => ({}))) as {
        schedules?: ScheduleRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load schedules");
        return;
      }
      setSchedules(data.schedules ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function createSchedule() {
    if (!canEdit || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const list = recipients
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/app/reports/${reportId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency,
          time,
          timezone,
          recipients: list,
          format,
          dayOfWeek: frequency === "weekly" ? dayOfWeek : undefined,
          dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create schedule");
        return;
      }
      setStatus("Schedule created");
      setRecipients("");
      await loadSchedules();
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(row: ScheduleRow) {
    if (!canEdit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextStatus = row.status === "active" ? "paused" : "active";
      const res = await fetch(`/api/app/reports/${reportId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: row.id,
          status: nextStatus,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update schedule");
        return;
      }
      await loadSchedules();
    } finally {
      setBusy(false);
    }
  }

  async function removeSchedule(row: ScheduleRow) {
    if (!canEdit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/reports/${reportId}/schedule/${row.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not remove schedule");
        return;
      }
      if (historyFor === row.id) setHistoryFor(null);
      await loadSchedules();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-rule bg-surface-1 text-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-ink">Schedule deliveries</DialogTitle>
          <p className="text-[13px] text-ink-muted">{reportLabel}</p>
        </DialogHeader>

        {error ? (
          <p className="border border-rule bg-surface-2 px-3 py-2 text-[13px] text-rust">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="border border-rule bg-surface-2 px-3 py-2 text-[13px] text-ink">
            {status}
          </p>
        ) : null}

        <div className="space-y-3 border-b border-rule pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Existing schedules
          </p>
          {loading ? (
            <p className="text-[13px] text-ink-muted">Loading…</p>
          ) : schedules.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No schedules yet.</p>
          ) : (
            <ul className="space-y-3">
              {schedules.map((row) => {
                const history = row.deliveryHistory ?? [];
                const showingHistory = historyFor === row.id;
                return (
                  <li
                    key={row.id}
                    className="border-t border-rule pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] text-ink">
                        {row.frequency} · {row.format.toUpperCase()} · {row.status}
                        {row.lastStatus ? (
                          <span className="text-ink-muted"> · last {row.lastStatus}</span>
                        ) : null}
                      </p>
                      <p className="font-data text-[12px] text-ink-muted">
                        Next {formatNextRun(row.nextRunAt)}
                      </p>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {formatRecipients(row)} · {row.time} {row.timezone}
                    </p>
                    {row.lastStatus === "failed" && row.lastError ? (
                      <p className="mt-1 text-[12px] text-rust">{row.lastError}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="text-[12px] text-accent underline-offset-2 hover:underline"
                        onClick={() => setHistoryFor(showingHistory ? null : row.id)}
                      >
                        {showingHistory
                          ? "Hide delivery history"
                          : `Delivery history (${history.length})`}
                      </button>
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            className="text-[12px] text-accent underline-offset-2 hover:underline"
                            disabled={busy}
                            onClick={() => void togglePause(row)}
                          >
                            {row.status === "active" ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            className="text-[12px] text-ink underline-offset-2 hover:underline"
                            disabled={busy}
                            onClick={() => void removeSchedule(row)}
                          >
                            Remove
                          </button>
                        </>
                      ) : null}
                    </div>
                    {showingHistory ? (
                      <div className="mt-3 border border-rule bg-surface-2 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                          Recent deliveries
                        </p>
                        {history.length === 0 ? (
                          <p className="mt-2 text-[12px] text-ink-muted">
                            No deliveries recorded yet.
                          </p>
                        ) : (
                          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                            {history.slice(0, 40).map((h, idx) => (
                              <li
                                key={`${h.runAt}-${h.email}-${idx}`}
                                className="border-t border-rule pt-2 first:border-t-0 first:pt-0"
                              >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className="text-[12px] text-ink">
                                    {h.email} · {h.status}
                                    {h.status === "sent" && (h.openCount ?? 0) > 0 ? (
                                      <span className="text-ink-muted">
                                        {" "}
                                        · opens{" "}
                                        <span className="font-data">{h.openCount}</span>
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="font-data text-[11px] text-ink-muted">
                                    {formatNextRun(h.sentAt || h.runAt)}
                                  </p>
                                </div>
                                {h.error ? (
                                  <p className="mt-0.5 text-[11px] text-rust">
                                    {h.error}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canEdit ? (
          <div className="space-y-3 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              New schedule
            </p>
            <label className="block text-[12px] text-ink-muted">
              Recipients (comma-separated)
              <input
                className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink outline-none focus:border-rule-strong"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="finance@acme.com, compliance@acme.com"
                disabled={busy}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] text-ink-muted">
                Frequency
                <select
                  className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink outline-none focus:border-rule-strong"
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as "daily" | "weekly" | "monthly")
                  }
                  disabled={busy}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="block text-[12px] text-ink-muted">
                Format
                <select
                  className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink outline-none focus:border-rule-strong"
                  value={format}
                  onChange={(e) =>
                    setFormat(e.target.value as "pdf" | "csv" | "json" | "xml")
                  }
                  disabled={busy}
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                </select>
              </label>
              <label className="block text-[12px] text-ink-muted">
                Time (local)
                <input
                  type="time"
                  className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 font-data text-[13px] text-ink outline-none focus:border-rule-strong"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="block text-[12px] text-ink-muted">
                Timezone
                <select
                  className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink outline-none focus:border-rule-strong"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={busy}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              {frequency === "weekly" ? (
                <label className="block text-[12px] text-ink-muted">
                  Day of week
                  <select
                    className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink outline-none focus:border-rule-strong"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    disabled={busy}
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {frequency === "monthly" ? (
                <label className="block text-[12px] text-ink-muted">
                  Day of month
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="mt-1 w-full border border-rule bg-canvas px-2 py-1.5 font-data text-[13px] text-ink outline-none focus:border-rule-strong"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    disabled={busy}
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">
            View only — ask an admin to create or pause schedules.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              disabled={busy || !recipients.trim()}
              onClick={() => void createSchedule()}
            >
              Create schedule
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
