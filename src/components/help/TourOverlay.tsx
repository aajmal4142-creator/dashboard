"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import type { TourDefinition } from "@/lib/help";
import { cn } from "@/lib/utils";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function resolveTarget(selector: string | undefined): Element | null {
  if (!selector || typeof document === "undefined") return null;
  return document.querySelector(`[data-tour="${selector}"]`);
}

function measure(el: Element | null): SpotlightRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return null;
  const pad = 6;
  return {
    top: Math.max(0, r.top - pad),
    left: Math.max(0, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function TourOverlay({
  tour,
  stepIndex,
  onNext,
  onPrev,
  onSkip,
  onClose,
}: {
  tour: TourDefinition;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const step = tour.steps[stepIndex];
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const total = tour.steps.length;
  const isLast = stepIndex >= total - 1;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    function update() {
      const el = resolveTarget(step?.target);
      if (el) {
        el.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: reducedMotion ? "auto" : "smooth",
        });
      }
      setRect(measure(el));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step?.target, stepIndex, reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, onNext, onPrev]);

  if (!step) return null;

  const cardStyle = rect
    ? {
        top: Math.min(
          rect.top + rect.height + 12,
          typeof window !== "undefined" ? window.innerHeight - 220 : rect.top,
        ),
        left: Math.min(
          Math.max(12, rect.left),
          typeof window !== "undefined" ? window.innerWidth - 340 : rect.left,
        ),
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
    >
      {/* Dim layer with spotlight cutout */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {rect ? (
          <div
            className={cn(
              "absolute rounded-[6px] border border-accent/80 bg-transparent",
              !reducedMotion && "transition-[top,left,width,height] duration-200",
            )}
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: "0 0 0 9999px color-mix(in srgb, var(--ink) 45%, transparent)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-ink/45" />
        )}
      </div>

      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss tour backdrop"
        onClick={onClose}
      />

      <div
        className={cn(
          "pointer-events-auto absolute z-10 w-[min(100%-24px,320px)] rounded-[6px] border border-rule bg-surface-1 shadow-[0_16px_40px_-20px_rgba(26,23,20,0.35)]",
          !rect && "left-1/2 top-[20vh] -translate-x-1/2",
        )}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-rule px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {tour.title} ·{" "}
            <span className="font-data tabular-nums">
              {stepIndex + 1}/{total}
            </span>
          </p>
          <h2 id="tour-step-title" className="mt-1 font-display text-base text-ink">
            {step.title}
          </h2>
        </div>
        <p className="px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {step.body}
        </p>
        {!rect && step.target ? (
          <p className="border-t border-rule px-4 py-2 text-[11px] text-ink-muted">
            Target not on this view — continue for the next step.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-2.5">
          <button
            type="button"
            className="text-[12px] text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-accent"
            onClick={onSkip}
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-[4px] border border-rule bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink disabled:opacity-40 focus-visible:outline-accent"
              disabled={stepIndex === 0}
              onClick={onPrev}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-[4px] bg-accent px-2.5 py-1.5 text-[12px] text-on-accent focus-visible:outline-accent"
              onClick={onNext}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
