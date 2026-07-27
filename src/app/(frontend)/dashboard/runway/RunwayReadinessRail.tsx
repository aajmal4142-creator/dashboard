import Link from "next/link";

import { Metric } from "@/components/ui/metric";
import { METRICS_HREF } from "@/lib/metrics";

import { formatDeadline } from "./format";
import { GoLink } from "./GoLink";
import { ProgressRing } from "./ProgressRing";
import { StatusBadge, calmBadgeTone } from "./StatusBadge";
import type { RunwayViewProps } from "./types";

type ReadinessCardProps = Pick<
  RunwayViewProps,
  | "calm"
  | "readiness"
  | "collected"
  | "required"
  | "days"
  | "filingOverdue"
  | "deadlineIso"
  | "standardVersion"
  | "primaryAction"
  | "projectedMiss"
>;

/** Readiness panel — lives inside the main Runway page, not as a shell sidebar. */
export function RunwayReadinessCard({
  calm,
  readiness,
  collected,
  required,
  days,
  filingOverdue,
  deadlineIso,
  standardVersion,
  primaryAction,
  projectedMiss,
}: ReadinessCardProps) {
  return (
    <section className="flex h-full flex-col rounded-[6px] border border-rule bg-surface-1 p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Readiness
        </p>
        <StatusBadge label={calm.label} tone={calmBadgeTone(calm.level)} />
      </div>

      <div className="mt-5 flex justify-center">
        <ProgressRing value={readiness.pct} size={140} className="max-md:scale-90" />
      </div>

      <p className="mt-3 text-center text-[13px] text-ink-muted">
        <Metric
          value={collected}
          size="sm"
          decimals={0}
          className="mr-1"
          inView={false}
        />
        of
        <Metric value={required} size="sm" decimals={0} className="mx-1" inView={false} />
        required metrics
      </p>

      <div
        className={
          filingOverdue || (days !== null && days <= 14)
            ? "mt-5 rounded-[6px] border border-rust/30 bg-rust/5 p-4"
            : "mt-5 rounded-[6px] border border-rule bg-surface-2 p-4"
        }
      >
        {days !== null ? (
          <>
            <Metric
              value={Math.abs(days)}
              size="xl"
              decimals={0}
              tone={filingOverdue ? "rust" : "ink"}
              inView={false}
            />
            <p className="label-caps mt-1">
              {filingOverdue ? "Days past filing" : "Days to filing"}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl text-ink">—</p>
            <p className="label-caps mt-1">Days to filing</p>
          </>
        )}
        <p className="mt-2 text-[12px] text-ink-muted">
          {deadlineIso
            ? `${formatDeadline(deadlineIso)}${standardVersion ? ` · ${standardVersion}` : ""}`
            : "No filing deadline on file"}
        </p>
        {projectedMiss > 0 && !filingOverdue ? (
          <p className="mt-2 text-[12px] text-rust">
            Projected miss{" "}
            <Metric
              value={projectedMiss}
              size="sm"
              decimals={0}
              tone="rust"
              className="inline-flex"
              inView={false}
            />{" "}
            days
          </p>
        ) : null}
        <p className="mt-3 text-[12px] text-ink-muted">{calm.hint}</p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Link
          href={primaryAction.href}
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          {primaryAction.label}
        </Link>
        <Link
          href={METRICS_HREF}
          className="inline-flex items-center justify-center rounded-md border border-rule bg-surface-1 px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          Enter metrics
        </Link>
      </div>

      <p className="mt-4 text-[12px] text-ink-muted">{primaryAction.need}</p>
      <GoLink href={primaryAction.href} className="mt-2 text-[12px]">
        Go there
      </GoLink>
    </section>
  );
}

/** @deprecated Use RunwayReadinessCard — kept name alias during migrate */
export const RunwayReadinessRail = RunwayReadinessCard;
