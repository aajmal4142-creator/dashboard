"use client";

import type { ReactNode } from "react";

import { Assemble } from "@/components/motion";
import { cn } from "@/lib/utils";

type PageFrameProps = {
  eyebrow: string;
  title: string;
  help?: string;
  children: ReactNode;
  /** Optional side rail for metadata / notes */
  rail?: ReactNode;
  className?: string;
  actions?: ReactNode;
  /** Full primary width — default true for operational pages */
  wide?: boolean;
  /** Sticky context: period label + last saved */
  context?: { period?: string; lastSaved?: string; status?: string };
};

/**
 * Shared /dashboard page chrome — matches Metrics / Runway:
 * accent eyebrow → bold H1 → help → accent rule → content.
 */
export function PageFrame({
  eyebrow,
  title,
  help,
  children,
  rail,
  className,
  actions,
  wide = true,
  context,
}: PageFrameProps) {
  return (
    <Assemble layer="structure" className={cn("min-h-full bg-canvas", className)}>
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
        {context ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule pb-3 text-[12px] text-ink-muted">
            {context.period ? (
              <span>
                Period <span className="font-data text-ink">{context.period}</span>
              </span>
            ) : null}
            {context.lastSaved ? (
              <span>
                Last saved <span className="font-data text-ink">{context.lastSaved}</span>
              </span>
            ) : null}
            {context.status ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                {context.status}
              </span>
            ) : null}
          </div>
        ) : null}

        <header className="border-b-2 border-accent pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-[28px] font-bold leading-tight text-ink">
                {title}
              </h1>
              {help ? (
                <p className="mt-2 max-w-[66ch] text-[13px] leading-relaxed text-ink-muted">
                  {help}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </header>

        <div className="mt-6">
          {rail ? (
            <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
              <div
                className={cn(
                  "min-w-0",
                  wide ? "lg:col-span-9" : "lg:col-span-8 lg:max-w-[66ch]",
                )}
              >
                {children}
              </div>
              <aside className="lg:col-span-3">
                <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
                  {rail}
                </div>
              </aside>
            </div>
          ) : (
            <div className={wide ? "w-full" : "max-w-[66ch]"}>{children}</div>
          )}
        </div>
      </div>
    </Assemble>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[6px] border border-dashed border-rule bg-surface-1 px-6 py-10 text-center">
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-[66ch] text-[13px] text-ink-muted">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StatusLine({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "error" | "ok";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "mt-3 text-[13px]",
        tone === "error" && "text-rust",
        tone === "ok" && "text-signal",
        tone === "neutral" && "text-ink-muted",
      )}
    >
      {children}
    </p>
  );
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 rounded-[4px] bg-surface-2" />
      ))}
    </div>
  );
}

/** Shared card shell for dashboard content blocks */
export function PageCard({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5",
        className,
      )}
    >
      {title ? (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {title}
        </p>
      ) : null}
      {children}
    </section>
  );
}
