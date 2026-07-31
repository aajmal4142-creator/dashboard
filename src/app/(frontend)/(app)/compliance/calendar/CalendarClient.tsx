"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  List,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { cn } from "@/lib/utils";

type DeadlineSeverity = "critical" | "high" | "medium";
type DeadlineStatus = "pending" | "in-progress" | "completed" | "missed";

type PrerequisiteTask = {
  id?: string;
  task: string;
  done: boolean;
};

type Deadline = {
  id: string;
  name: string;
  description?: string;
  documentationUrl?: string;
  type: string;
  jurisdiction: string;
  country?: string;
  framework: string;
  dueDate: string;
  scope: string;
  severity: DeadlineSeverity;
  status: DeadlineStatus;
  daysRemaining: number;
  urgent: boolean;
  prerequisiteTasks: PrerequisiteTask[];
};

type CalendarDay = {
  date: string;
  deadlines: Deadline[];
  isToday: boolean;
  isOverdue: boolean;
};

type CalendarData = {
  year: number;
  month: number;
  days: CalendarDay[];
};

type Summary = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  missed: number;
  overdue: number;
  urgent: number;
  dueInNext7Days: number;
  dueInNext30Days: number;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function severityBorder(severity: DeadlineSeverity): string {
  switch (severity) {
    case "critical":
      return "border-[color:var(--rust)]";
    case "high":
      return "border-[color:var(--amber)]";
    default:
      return "border-[color:var(--cobalt)]";
  }
}

function severityInk(severity: DeadlineSeverity): string {
  switch (severity) {
    case "critical":
      return "text-[color:var(--rust)]";
    case "high":
      return "text-[color:var(--amber)]";
    default:
      return "text-[color:var(--cobalt)]";
  }
}

function statusLabel(status: DeadlineStatus): string {
  switch (status) {
    case "in-progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "missed":
      return "Missed";
    default:
      return "Pending";
  }
}

function StatusIcon({ status }: { status: DeadlineStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 text-[color:var(--signal)]" aria-hidden />;
  }
  if (status === "in-progress") {
    return <Clock className="size-4 text-[color:var(--amber)]" aria-hidden />;
  }
  if (status === "missed") {
    return <AlertTriangle className="size-4 text-[color:var(--rust)]" aria-hidden />;
  }
  return <AlertCircle className="size-4 text-[color:var(--ink-muted)]" aria-hidden />;
}

function formatDue(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `${days} days left`;
}

export function CalendarClient() {
  const [mode, setMode] = useState<"calendar" | "today">("calendar");
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [todayList, setTodayList] = useState<Deadline[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<Deadline | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const calParams = new URLSearchParams({
          view: "calendar",
          year: String(year),
          month: String(month),
        });
        const [calRes, listRes, sumRes] = await Promise.all([
          fetch(`/api/app/compliance/calendar?${calParams}`),
          fetch("/api/app/compliance/deadlines?view=today"),
          fetch("/api/app/compliance/calendar?view=summary"),
        ]);

        const calData = (await calRes.json()) as CalendarData & { error?: string };
        const listData = (await listRes.json()) as {
          deadlines?: Deadline[];
          error?: string;
        };
        const sumData = (await sumRes.json()) as Summary & { error?: string };

        if (!calRes.ok) {
          setTone("error");
          setMessage(calData.error ?? "Failed to load calendar");
          setLoaded(true);
          return;
        }
        if (!listRes.ok) {
          setTone("error");
          setMessage(listData.error ?? "Failed to load deadlines");
          setLoaded(true);
          return;
        }

        setCalendarData(calData);
        setTodayList(listData.deadlines ?? []);
        if (sumRes.ok) setSummary(sumData);
        setTone("neutral");
        setMessage(null);
        setLoaded(true);
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to load calendar");
        setLoaded(true);
      }
    });
  }, [year, month]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  async function handleExport() {
    try {
      const response = await fetch("/api/app/compliance/calendar/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deadlines-${new Date().toISOString().slice(0, 10)}.ics`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setTone("error");
      setMessage("Export failed. Try again.");
    }
  }

  async function markStatus(deadlineId: string, status: DeadlineStatus) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/compliance/deadlines/${deadlineId}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = (await res.json()) as { deadline?: Deadline; error?: string };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to update status");
          return;
        }
        setTone("ok");
        setMessage(`Marked ${statusLabel(status).toLowerCase()}.`);
        if (data.deadline) setSelected(data.deadline);
        load();
      } catch {
        setTone("error");
        setMessage("Failed to update status");
      }
    });
  }

  if (!loaded && pending) {
    return <p className="text-sm text-[color:var(--ink-muted)]">Loading calendar…</p>;
  }

  return (
    <div className="space-y-6">
      {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Applicable", value: summary.total },
            { label: "Urgent (<30d)", value: summary.urgent },
            { label: "Due in 7 days", value: summary.dueInNext7Days },
            { label: "Overdue", value: summary.overdue },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4"
            >
              <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                {card.label}
              </div>
              <div className="mt-1 font-mono text-2xl tabular-nums text-[color:var(--ink)]">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-[color:var(--rule)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "calendar" ? "default" : "outline"}
            onClick={() => setMode("calendar")}
            className="gap-2"
          >
            <Calendar className="size-4" aria-hidden />
            Monthly
          </Button>
          <Button
            type="button"
            variant={mode === "today" ? "default" : "outline"}
            onClick={() => setMode("today")}
            className="gap-2"
          >
            <List className="size-4" aria-hidden />
            By urgency
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={handleExport} className="gap-2">
          <Download className="size-4" aria-hidden />
          Export iCal
        </Button>
      </div>

      {mode === "calendar" && calendarData ? (
        <div className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)]">
          <div className="flex items-center justify-between border-b border-[color:var(--rule)] px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              {MONTHS[month]} <span className="font-mono tabular-nums">{year}</span>
            </h2>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handlePrevMonth}>
                <ChevronLeft className="size-4" aria-hidden />
                <span className="sr-only">Previous month</span>
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleNextMonth}>
                <ChevronRight className="size-4" aria-hidden />
                <span className="sr-only">Next month</span>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto p-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <th
                      key={day}
                      className="p-2 text-center text-xs font-medium text-[color:var(--ink-muted)]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildMonthRows(calendarData, month, year).map((row, idx) => (
                  <tr key={idx}>
                    {row.map((day, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={cn(
                          "min-h-24 align-top border border-[color:var(--rule)] p-2",
                          !day && "bg-[color:var(--surface-2)]",
                          day?.isToday && "bg-[color:var(--accent-quiet)]",
                        )}
                      >
                        {day ? (
                          <div className="space-y-1">
                            <div
                              className={cn(
                                "font-mono text-xs tabular-nums",
                                day.isToday
                                  ? "text-[color:var(--accent)]"
                                  : "text-[color:var(--ink-muted)]",
                              )}
                            >
                              {Number(day.date.slice(8, 10))}
                            </div>
                            <div className="space-y-1">
                              {day.deadlines.map((deadline) => (
                                <button
                                  key={deadline.id}
                                  type="button"
                                  onClick={() => setSelected(deadline)}
                                  className={cn(
                                    "w-full rounded-[2px] border-l-2 bg-[color:var(--surface-2)] px-1.5 py-1 text-left text-[10px] leading-tight text-[color:var(--ink)]",
                                    severityBorder(deadline.severity),
                                    deadline.urgent && "ring-1 ring-[color:var(--rust)]",
                                  )}
                                >
                                  <span className="line-clamp-2">{deadline.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {mode === "today" ? (
        <div className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)]">
          <div className="border-b border-[color:var(--rule)] px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              Sorted by urgency
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              Applicable deadlines only. Days remaining from the server.
            </p>
          </div>
          {todayList.length === 0 ? (
            <EmptyState
              title="No deadlines in this view"
              body="No applicable incomplete deadlines for your organisation profile."
            />
          ) : (
            <ul className="divide-y divide-[color:var(--rule)]">
              {todayList.map((deadline) => (
                <li key={deadline.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(deadline)}
                    className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left hover:bg-[color:var(--surface-2)]"
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon status={deadline.status} />
                      <div>
                        <div className="font-medium text-[color:var(--ink)]">
                          {deadline.name}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[color:var(--ink-muted)]">
                          <span>{deadline.type}</span>
                          <span>·</span>
                          <span>{deadline.jurisdiction}</span>
                          <span
                            className={cn(
                              "rounded-[2px] px-1.5 py-0.5 uppercase tracking-wide",
                              severityInk(deadline.severity),
                            )}
                          >
                            {deadline.severity}
                          </span>
                          {deadline.urgent ? (
                            <span className="text-[color:var(--rust)]">Urgent</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm tabular-nums text-[color:var(--ink)]">
                        {formatDue(deadline.dueDate)}
                      </div>
                      <div
                        className={cn(
                          "mt-1 font-mono text-xs tabular-nums",
                          deadline.urgent || deadline.daysRemaining < 0
                            ? "text-[color:var(--rust)]"
                            : "text-[color:var(--ink-muted)]",
                        )}
                      >
                        {daysLabel(deadline.daysRemaining)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {selected ? (
        <DetailModal
          deadline={selected}
          pending={pending}
          onClose={() => setSelected(null)}
          onStatus={markStatus}
        />
      ) : null}
    </div>
  );
}

function DetailModal({
  deadline,
  pending,
  onClose,
  onStatus,
}: {
  deadline: Deadline;
  pending: boolean;
  onClose: () => void;
  onStatus: (id: string, status: DeadlineStatus) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deadline-detail-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[color:var(--rule-strong)] bg-[color:var(--surface-1)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--rule)] px-4 py-3">
          <div>
            <h2
              id="deadline-detail-title"
              className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]"
            >
              {deadline.name}
            </h2>
            <p className="mt-1 font-mono text-sm tabular-nums text-[color:var(--ink-muted)]">
              {formatDue(deadline.dueDate)} — {daysLabel(deadline.daysRemaining)}
              {deadline.urgent ? " · urgent" : ""}
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-[2px] border border-[color:var(--rule)] px-2 py-0.5">
              {deadline.type}
            </span>
            <span className="rounded-[2px] border border-[color:var(--rule)] px-2 py-0.5">
              {deadline.framework}
            </span>
            <span className="rounded-[2px] border border-[color:var(--rule)] px-2 py-0.5">
              {deadline.jurisdiction}
            </span>
            <span
              className={cn(
                "rounded-[2px] border px-2 py-0.5 uppercase",
                severityBorder(deadline.severity),
                severityInk(deadline.severity),
              )}
            >
              {deadline.severity}
            </span>
            <span className="rounded-[2px] border border-[color:var(--rule)] px-2 py-0.5">
              {statusLabel(deadline.status)}
            </span>
          </div>

          {deadline.description ? (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                Regulation
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink)]">
                {deadline.description}
              </p>
            </div>
          ) : null}

          {deadline.documentationUrl ? (
            <a
              href={deadline.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[color:var(--accent)] underline-offset-2 hover:underline"
            >
              Official documentation
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}

          <div>
            <h3 className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Checklist
            </h3>
            {deadline.prerequisiteTasks.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
                No prerequisite tasks listed.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {deadline.prerequisiteTasks.map((task, i) => (
                  <li
                    key={task.id ?? `${deadline.id}-task-${i}`}
                    className="flex items-start gap-2 text-sm text-[color:var(--ink)]"
                  >
                    <span
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0 rounded-[2px] border border-[color:var(--rule-strong)]",
                        task.done && "bg-[color:var(--signal)]",
                      )}
                      aria-hidden
                    />
                    <span
                      className={
                        task.done ? "text-[color:var(--ink-muted)] line-through" : ""
                      }
                    >
                      {task.task}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[color:var(--rule)] pt-4">
            {deadline.status !== "completed" ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => onStatus(deadline.id, "completed")}
              >
                Mark completed
              </Button>
            ) : null}
            {deadline.status === "pending" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onStatus(deadline.id, "in-progress")}
              >
                Mark in progress
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMonthRows(
  calendarData: CalendarData,
  month: number,
  year: number,
): Array<Array<CalendarDay | null>> {
  const firstDay = new Date(year, month, 1).getDay();
  const rows: Array<Array<CalendarDay | null>> = [];
  let currentRow: Array<CalendarDay | null> = [];

  for (let i = 0; i < firstDay; i++) {
    currentRow.push(null);
  }

  for (const day of calendarData.days) {
    currentRow.push(day);
    if (currentRow.length === 7) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  while (currentRow.length > 0 && currentRow.length < 7) {
    currentRow.push(null);
  }
  if (currentRow.length === 7) {
    rows.push(currentRow);
  }

  return rows;
}
