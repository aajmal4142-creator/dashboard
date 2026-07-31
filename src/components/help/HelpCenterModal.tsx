"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";

import { useTourOptional } from "@/components/help/TourProvider";
import {
  DEFAULT_SHORTCUTS,
  detectShortcutPlatform,
  formatShortcutLabel,
} from "@/lib/keyboard";
import {
  FAQ_ITEMS,
  TOURS,
  filterFaq,
  getCompletedTourIds,
  getContextTip,
  isTourCompleted,
  type HelpTab,
} from "@/lib/help";
import { cn } from "@/lib/utils";

const TABS: { id: HelpTab; label: string }[] = [
  { id: "shortcuts", label: "Shortcuts" },
  { id: "tours", label: "Tours" },
  { id: "faq", label: "FAQ" },
];

export function HelpCenterModal({
  open,
  onOpenChange,
  initialTab = "shortcuts",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: HelpTab;
}) {
  const pathname = usePathname();
  const tourApi = useTourOptional();
  const [tab, setTab] = useState<HelpTab>(initialTab);
  const [platform, setPlatform] = useState<"mac" | "win">("mac");
  const [faqQuery, setFaqQuery] = useState("");
  const [completedTick, setCompletedTick] = useState(0);

  const context = useMemo(() => getContextTip(pathname), [pathname]);
  const faqResults = useMemo(() => filterFaq(faqQuery), [faqQuery]);
  const completedIds = useMemo(() => {
    void completedTick;
    return getCompletedTourIds();
  }, [completedTick]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setTab(initialTab);
      setCompletedTick((n) => n + 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, initialTab]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPlatform(detectShortcutPlatform());
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  if (!open) return null;

  function startTour(tourId: string) {
    onOpenChange(false);
    tourApi?.startTour(tourId);
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close help"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-center-title"
        className="relative mx-auto mt-[8vh] w-full max-w-lg overflow-hidden rounded-[6px] border border-rule bg-surface-1 px-0 shadow-[0_16px_40px_-20px_rgba(26,23,20,0.35)]"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <CircleHelp className="size-4 shrink-0 text-accent" aria-hidden />
            <h2 id="help-center-title" className="font-display text-base text-ink">
              Help
            </h2>
          </div>
          <button
            type="button"
            className="rounded-[4px] p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-accent"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Context strip */}
        <div className="border-b border-rule bg-surface-2/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
            This page · {context.title}
          </p>
          <ul className="mt-1.5 space-y-1">
            {context.tips.map((tip) => (
              <li key={tip} className="text-[12px] leading-snug text-ink-muted">
                {tip}
              </li>
            ))}
          </ul>
          {context.relatedTourId ? (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-accent"
              onClick={() => {
                const id = context.relatedTourId;
                if (id) startTour(id);
              }}
            >
              Start related tour
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Help sections"
          className="flex border-b border-rule"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              id={`help-tab-${t.id}`}
              aria-controls={`help-panel-${t.id}`}
              className={cn(
                "flex-1 px-3 py-2.5 text-[12px] font-medium focus-visible:outline-accent",
                tab === t.id
                  ? "border-b-2 border-accent text-ink"
                  : "text-ink-muted hover:text-ink",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`help-panel-${tab}`}
          aria-labelledby={`help-tab-${tab}`}
          className="max-h-[50vh] overflow-y-auto"
        >
          {tab === "shortcuts" ? (
            <ul className="py-2">
              {DEFAULT_SHORTCUTS.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-4 border-b border-rule/60 px-4 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">{s.context}</p>
                  </div>
                  <kbd className="shrink-0 rounded-[2px] border border-rule bg-surface-2 px-1.5 py-0.5 font-data text-[11px] text-ink tabular-nums">
                    {formatShortcutLabel(s.chord, platform)}
                  </kbd>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "tours" ? (
            <ul className="divide-y divide-rule/60 py-1">
              {TOURS.length === 0 ? (
                <li className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  No tours available yet.
                </li>
              ) : (
                TOURS.map((tour) => {
                  const done = completedIds.includes(tour.id) || isTourCompleted(tour.id);
                  return (
                    <li
                      key={tour.id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{tour.title}</p>
                        <p className="mt-0.5 text-[12px] text-ink-muted">
                          {tour.description}
                        </p>
                        <p className="mt-1 font-data text-[11px] text-ink-muted tabular-nums">
                          {tour.steps.length} steps
                          {done ? " · completed" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-[4px] border border-rule bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink hover:border-rule-strong focus-visible:outline-accent"
                        onClick={() => startTour(tour.id)}
                      >
                        {done ? "Replay" : "Start"}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}

          {tab === "faq" ? (
            <div className="py-2">
              <div className="px-4 pb-2">
                <label className="sr-only" htmlFor="help-faq-search">
                  Search FAQ
                </label>
                <input
                  id="help-faq-search"
                  type="search"
                  value={faqQuery}
                  onChange={(e) => setFaqQuery(e.target.value)}
                  placeholder="Search FAQ…"
                  className="w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-rule-strong focus:outline-none"
                />
              </div>
              {faqResults.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  No FAQ matches for “{faqQuery.trim()}”. Try another term or open the
                  Tours tab.
                </p>
              ) : (
                <ul>
                  {faqResults.map((item) => (
                    <li
                      key={item.id}
                      className="border-b border-rule/60 px-4 py-3 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-ink">{item.question}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                        {item.answer}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {faqQuery.trim() === "" && FAQ_ITEMS.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  FAQ is empty.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-rule px-4 py-2 text-[11px] text-ink-muted">
          {tab === "shortcuts" ? (
            <>
              Labels show {platform === "mac" ? "⌘ (Mac)" : "Ctrl (Windows/Linux)"}. Press{" "}
              <span className="font-data">Esc</span> to close.
            </>
          ) : (
            <>
              Press <span className="font-data">Esc</span> to close. Getting started
              checklist:{" "}
              <a href="/guide" className="text-accent underline-offset-2 hover:underline">
                Guide
              </a>
              .
            </>
          )}
        </div>
      </div>
    </div>
  );
}
