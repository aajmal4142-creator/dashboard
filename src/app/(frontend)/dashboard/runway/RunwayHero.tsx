import type { ReactNode } from "react";
import Link from "next/link";

import { Assemble, InkReveal } from "@/components/motion";
import { Metric } from "@/components/ui/metric";
import { METRICS_HREF } from "@/lib/metrics";
import type { CalmLevel } from "@/lib/governance/calmStatus";
import { cn } from "@/lib/utils";

import { formatDeadline } from "./format";
import { GoLink } from "./GoLink";
import { RunwayGaugeSlot } from "./RunwayGaugeSlot";

type RunwayToolbarProps = {
  periodLabel: string | null;
  calm: { level: CalmLevel; label: string };
  primaryAction: { label: string; href: string };
};

function calmChipClass(level: CalmLevel): string {
  if (level === "critical") return "bg-rust/10 text-rust";
  if (level === "at_risk") return "bg-amber/10 text-amber";
  if (level === "on_track") return "bg-signal/10 text-signal";
  return "bg-surface-2 text-ink-muted";
}

export function RunwayToolbar({ periodLabel, calm, primaryAction }: RunwayToolbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-2xl text-ink md:text-3xl">Runway</h1>
          <span
            className={cn(
              "rounded-xs px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
              calmChipClass(calm.level),
            )}
          >
            {calm.label}
          </span>
        </div>
        {periodLabel ? (
          <p className="mt-1 text-xs text-ink-muted">
            Period <span className="font-data text-ink">{periodLabel}</span>
          </p>
        ) : null}
      </div>
      <Link
        href={primaryAction.href}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
      >
        {primaryAction.label}
      </Link>
    </header>
  );
}

type RunwayHeroProps = {
  days: number | null;
  filingOverdue: boolean;
  deadlineIso: string | null;
  standardVersion: string | null;
  wave: string | null;
  calmHint: string;
  projectedMiss: number;
  calcOk: boolean;
  overall: number;
  readinessPct: number;
  coveragePct: number | null;
  pendingApproval: number;
  assignedCount: number;
  overdueCount: number;
  collected: number;
  required: number;
  primaryNeed: string;
  primaryHref: string;
};

export function RunwayHero({
  days,
  filingOverdue,
  deadlineIso,
  standardVersion,
  wave,
  calmHint,
  projectedMiss,
  calcOk,
  overall,
  readinessPct,
  coveragePct,
  pendingApproval,
  assignedCount,
  overdueCount,
  collected,
  required,
  primaryNeed,
  primaryHref,
}: RunwayHeroProps) {
  const waveLabel =
    wave && !["other", "brsr_listed", "brsr_supply"].includes(wave)
      ? ` Wave ${wave}`
      : null;

  return (
    <InkReveal className="border-b border-rule py-8">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-5">
          <p className="text-sm text-ink-muted">{calmHint}</p>
          <div className="mt-4">
            {days !== null ? (
              <Metric
                value={Math.abs(days)}
                size="display"
                decimals={0}
                tone={filingOverdue ? "rust" : "ink"}
                inView={false}
              />
            ) : (
              <p className="font-display text-5xl text-ink">—</p>
            )}
          </div>
          <p className="label-caps mt-2">
            {filingOverdue ? "Days past filing" : "Days to filing"}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {deadlineIso ? (
              <>
                {formatDeadline(deadlineIso)}
                {standardVersion ? ` · ${standardVersion}` : null}
                {waveLabel}
              </>
            ) : (
              "No filing deadline on file"
            )}
          </p>
          {projectedMiss > 0 && !filingOverdue ? (
            <p className="mt-3 text-sm text-rust">
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
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs text-ink-muted">{primaryNeed}</p>
            <GoLink href={primaryHref} className="text-xs">
              Go there
            </GoLink>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-3">
            <div className="border-b border-rule py-4 sm:border-r sm:border-b-0 sm:pr-5">
              <p className="label-caps">Readiness</p>
              <Metric
                value={readinessPct}
                unit="%"
                size="xl"
                decimals={0}
                className="mt-3"
                inView={false}
              />
              <div className="mt-3 h-1 overflow-hidden bg-surface-2">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.min(100, readinessPct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                <Metric
                  value={collected}
                  size="sm"
                  decimals={0}
                  className="mr-1"
                  inView={false}
                />
                of
                <Metric
                  value={required}
                  size="sm"
                  decimals={0}
                  className="mx-1"
                  inView={false}
                />
                required
              </p>
              <GoLink href={METRICS_HREF} className="mt-3 text-xs">
                Enter metrics
              </GoLink>
            </div>

            <div className="border-b border-rule py-4 sm:border-r sm:border-b-0 sm:px-5">
              <p className="label-caps">Supplier coverage</p>
              {coveragePct !== null ? (
                <Metric
                  value={coveragePct}
                  unit="%"
                  size="xl"
                  decimals={0}
                  className="mt-3"
                  inView={false}
                />
              ) : (
                <p className="mt-3 font-display text-2xl text-ink">—</p>
              )}
              <p className="mt-2 text-xs text-ink-muted">Spend with supplier data</p>
              <GoLink href="/dashboard/suppliers" className="mt-3 text-xs">
                Manage suppliers
              </GoLink>
            </div>

            <div className="py-4 sm:pl-5">
              <p className="label-caps">Pending approval</p>
              <Metric
                value={pendingApproval}
                size="xl"
                decimals={0}
                tone={pendingApproval > 0 ? "amber" : "signal"}
                className="mt-3"
                inView={false}
              />
              <p className="mt-2 text-xs text-ink-muted">
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
              </p>
              <GoLink href={METRICS_HREF} className="mt-3 text-xs">
                Review approvals
              </GoLink>
            </div>
          </div>

          {calcOk ? (
            <div className="mt-6 flex items-center gap-5 border-t border-rule pt-5">
              <RunwayGaugeSlot score={overall} size={160} />
              <div>
                <p className="label-caps">Overall score</p>
                <Metric
                  value={overall}
                  size="xl"
                  decimals={0}
                  className="mt-2"
                  inView={false}
                />
                <p className="mt-1 text-xs text-ink-muted">Live from this period</p>
                <GoLink href="/dashboard/reports" className="mt-3 text-xs">
                  View reports
                </GoLink>
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-rule pt-5">
              <p className="text-sm text-ink-muted">
                Score unavailable until activity metrics and factors are in place.
              </p>
              <GoLink href={METRICS_HREF} className="mt-2 text-xs">
                Enter metrics
              </GoLink>
            </div>
          )}
        </div>
      </div>
    </InkReveal>
  );
}

export function RunwayPageChrome({ children }: { children: ReactNode }) {
  return (
    <Assemble
      layer="structure"
      className="min-h-full bg-surface-1 px-6 py-6 md:px-8 md:py-8"
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </Assemble>
  );
}
