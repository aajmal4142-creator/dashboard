"use client";

import { Bell, Check, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { NotificationGroup, NotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

type ListResponse = {
  groups?: NotificationGroup[];
  notifications?: NotificationItem[];
  error?: string;
};

type CountResponse = {
  count?: number;
  error?: string;
};

function hrefForNotification(item: NotificationItem): string | null {
  if (item.resourceType === "datapoint" && item.resourceId) {
    return `/data?datapoint=${encodeURIComponent(item.resourceId)}`;
  }
  if (item.resourceType === "report" && item.resourceId) {
    return `/reports`;
  }
  if (item.resourceType === "audit" && item.resourceId) {
    return `/assurance`;
  }
  return null;
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationBell({
  className,
  dropdown = "up",
}: {
  className?: string;
  /** Sidebar footer opens upward; header chrome opens downward. */
  dropdown?: "up" | "down";
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [listState, setListState] = useState<"idle" | "loading" | "error">("idle");
  const [listError, setListError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/app/notifications/unread-count", {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const body = (await res.json()) as CountResponse;
      if (typeof body.count === "number") {
        setUnread(body.count);
      }
    } catch {
      /* keep last known count */
    }
  }, []);

  const loadList = useCallback(async () => {
    setListState("loading");
    setListError(null);
    try {
      const res = await fetch("/api/app/notifications?limit=30", {
        credentials: "same-origin",
      });
      const body = (await res.json()) as ListResponse;
      if (!res.ok) {
        setListState("error");
        setListError(body.error ?? "Could not load notifications.");
        return;
      }
      setGroups(body.groups ?? []);
      setListState("idle");
    } catch {
      setListState("error");
      setListError("Could not load notifications. Check your connection and retry.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCount();
    }, 0);
    const id = window.setInterval(() => {
      void refreshCount();
    }, POLL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(id);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadList();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, loadList]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(id: string) {
    const res = await fetch(`/api/app/notifications/${id}/read`, {
      method: "PATCH",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      })),
    );
    setUnread((n) => Math.max(0, n - 1));
  }

  async function removeOne(id: string) {
    const res = await fetch(`/api/app/notifications/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    let wasUnread = false;
    setGroups((prev) =>
      prev
        .map((g) => {
          const items = g.items.filter((item) => {
            if (item.id === id) {
              if (!item.isRead) wasUnread = true;
              return false;
            }
            return true;
          });
          return { ...g, items };
        })
        .filter((g) => g.items.length > 0),
    );
    if (wasUnread) setUnread((n) => Math.max(0, n - 1));
  }

  async function markAllRead() {
    const res = await fetch("/api/app/notifications", {
      method: "PATCH",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) => ({ ...item, isRead: true })),
      })),
    );
    setUnread(0);
  }

  const badge = unread > 99 ? "99+" : unread > 0 ? String(unread) : null;

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative size-8 shrink-0 rounded-full border-rule bg-surface-1 text-ink shadow-none",
          "hover:bg-surface-2 hover:text-ink",
        )}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={panelId}
        title="Notifications"
      >
        <Bell className="size-4" aria-hidden />
        {badge ? (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-[2px] bg-accent px-0.5 font-data text-[10px] leading-none text-on-accent"
            aria-hidden
          >
            {badge}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "absolute right-0 z-50 flex w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-[6px] border border-rule bg-surface-1 shadow-[0_16px_40px_-20px_rgba(26,23,20,0.35)]",
            dropdown === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
            <p className="label-caps text-[10px] text-ink-muted">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 ? (
                <button
                  type="button"
                  className="rounded-[4px] px-1.5 py-1 text-[11px] text-ink-muted hover:bg-surface-2 hover:text-ink"
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-[4px] p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listState === "loading" ? (
              <p className="px-3 py-6 text-center text-xs text-ink-muted">
                Loading notifications…
              </p>
            ) : null}

            {listState === "error" ? (
              <div className="space-y-2 px-3 py-6 text-center">
                <p className="text-xs text-ink-muted">
                  {listError ?? "Could not load notifications."}
                </p>
                <button
                  type="button"
                  className="text-xs text-accent underline-offset-2 hover:underline"
                  onClick={() => void loadList()}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {listState === "idle" && groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink-muted">
                No notifications yet.
              </p>
            ) : null}

            {listState === "idle"
              ? groups.map((group) => (
                  <section
                    key={group.type}
                    className="border-b border-rule last:border-b-0"
                  >
                    <h3 className="sticky top-0 bg-surface-1 px-3 py-1.5 label-caps text-[10px] text-ink-muted">
                      {group.label}
                    </h3>
                    <ul className="divide-y divide-rule">
                      {group.items.map((item) => {
                        const href = hrefForNotification(item);
                        const body = (
                          <>
                            <p
                              className={cn(
                                "text-xs leading-snug text-ink",
                                !item.isRead && "font-medium",
                              )}
                            >
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                              {item.message}
                            </p>
                            <p className="mt-1 font-data text-[10px] text-ink-muted">
                              {relativeTime(item.createdAt)}
                            </p>
                          </>
                        );
                        return (
                          <li
                            key={item.id}
                            className={cn(
                              "flex gap-2 px-3 py-2",
                              !item.isRead && "bg-accent-quiet/40",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              {href ? (
                                <Link
                                  href={href}
                                  className="block hover:opacity-90"
                                  onClick={() => {
                                    if (!item.isRead) void markRead(item.id);
                                    setOpen(false);
                                  }}
                                >
                                  {body}
                                </Link>
                              ) : (
                                body
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col gap-0.5">
                              {!item.isRead ? (
                                <button
                                  type="button"
                                  className="rounded-[4px] p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
                                  aria-label="Mark as read"
                                  title="Mark as read"
                                  onClick={() => void markRead(item.id)}
                                >
                                  <Check className="size-3.5" aria-hidden />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="rounded-[4px] p-1 text-ink-muted hover:bg-surface-2 hover:text-rust"
                                aria-label="Delete notification"
                                title="Delete"
                                onClick={() => void removeOne(item.id)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
