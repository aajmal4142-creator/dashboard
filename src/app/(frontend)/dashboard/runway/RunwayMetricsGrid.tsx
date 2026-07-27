import type { ReactNode } from "react";
import Link from "next/link";

import { Metric } from "@/components/ui/metric";
import { METRICS_HREF } from "@/lib/metrics";
import { cn } from "@/lib/utils";

import { GoLink } from "./GoLink";

type RunwayMetricsGridProps = {
  days: number | null;
  filingOverdue: boolean;
  coveragePct: number | null;
  pendingApproval: number;
  assignedCount: number;
  overdueCount: number;
};

function MetricCard({
  label,
  children,
  hint,
  href,
  cta,
  className,
}: {
  label: string;
  children: ReactNode;
  hint: ReactNode;
  href: string;
  cta: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </p>
      <div className="mt-3">{children}</div>
      <p className="mt-2 text-[12px] text-ink-muted">{hint}</p>
      <GoLink href={href} className="mt-3 text-[12px]">
        {cta}
      </GoLink>
    </div>
  );
}

export function RunwayMetricsGrid({
  days,
  filingOverdue,
  coveragePct,
  pendingApproval,
  assignedCount,
  overdueCount,
}: RunwayMetricsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label={filingOverdue ? "Days past deadline" : "Days to deadline"}
        href={METRICS_HREF}
        cta="Enter metrics"
        hint={
          days === null
            ? "No deadline on file"
            : filingOverdue
              ? "Filing date has passed"
              : "Countdown to filing"
        }
      >
        {days !== null ? (
          <Metric
            value={Math.abs(days)}
            size="xl"
            decimals={0}
            tone={filingOverdue ? "rust" : "ink"}
            inView={false}
          />
        ) : (
          <span className="font-display text-[28px] font-bold text-ink">—</span>
        )}
      </MetricCard>

      <MetricCard
        label="Supplier coverage"
        href="/dashboard/suppliers"
        cta="Manage suppliers"
        hint="Spend with supplier data"
      >
        {coveragePct !== null ? (
          <Metric value={coveragePct} unit="%" size="xl" decimals={0} inView={false} />
        ) : (
          <Metric value={0} unit="%" size="xl" decimals={0} inView={false} />
        )}
      </MetricCard>

      <MetricCard
        label="Pending approval"
        href={METRICS_HREF}
        cta="Review approvals"
        className="sm:col-span-2 xl:col-span-1"
        hint={
          <>
            <Metric
              value={assignedCount}
              size="sm"
              decimals={0}
              className="mr-1"
              inView={false}
            />
            assigned
            {overdueCount > 0 ? (
              <>
                {" · "}
                <Metric
                  value={overdueCount}
                  size="sm"
                  decimals={0}
                  tone="rust"
                  className="mr-1"
                  inView={false}
                />
                overdue
              </>
            ) : null}
          </>
        }
      >
        <Metric
          value={pendingApproval}
          size="xl"
          decimals={0}
          tone={pendingApproval > 0 ? "amber" : "signal"}
          inView={false}
        />
      </MetricCard>
    </div>
  );
}

export function RunwayMainHeader({ periodLabel }: { periodLabel: string | null }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ink">Runway Report</h1>
        {periodLabel ? (
          <p className="mt-1 text-[13px] text-ink-muted">
            Period <span className="font-data text-ink">{periodLabel}</span>
          </p>
        ) : null}
      </div>
      <Link
        href="/dashboard/reports"
        className="text-[13px] font-medium text-accent underline-offset-2 hover:underline"
      >
        View reports →
      </Link>
    </div>
  );
}
