"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useDashboardRealtime } from "@/lib/realtime/useDashboardRealtime";
import { cn } from "@/lib/utils";

import { RunwayActions } from "./RunwayActions";
import { RunwayAnomalies } from "./RunwayAnomalies";
import { RunwayEmissions } from "./RunwayEmissions";
import { RunwayFiling } from "./RunwayFiling";
import { RunwayFooter } from "./RunwayFooter";
import { RunwayIntensityCard } from "./RunwayIntensityCard";
import { RunwayMainHeader, RunwayMetricsGrid } from "./RunwayMetricsGrid";
import { RunwayPeerCard } from "./RunwayPeerCard";
import { RunwayReadinessCard } from "./RunwayReadinessRail";
import type { RunwayViewProps } from "./types";

function formatAgo(seconds: number): string {
  if (seconds < 1) return "just now";
  if (seconds === 1) return "1s ago";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins === 1) return "1m ago";
  return `${mins}m ago`;
}

function LiveStatusBar({
  connection,
  lastUpdatedAt,
  activityLabel,
}: {
  connection: "connecting" | "live" | "polling" | "offline";
  lastUpdatedAt: number | null;
  activityLabel: string | null;
}) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const agoSec =
    lastUpdatedAt != null ? Math.max(0, Math.floor((now - lastUpdatedAt) / 1000)) : null;

  const statusLabel =
    connection === "live"
      ? "Live"
      : connection === "polling"
        ? "Polling"
        : connection === "connecting"
          ? "Connecting"
          : "Offline";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-rule pb-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          {connection === "live" || connection === "polling" ? (
            <motion.span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full bg-signal opacity-60",
                reduced && "opacity-0",
              )}
              animate={
                reduced ? undefined : { scale: [1, 1.85, 1], opacity: [0.55, 0, 0.55] }
              }
              transition={
                reduced
                  ? undefined
                  : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              }
            />
          ) : null}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              connection === "live" && "bg-signal",
              connection === "polling" && "bg-amber",
              connection === "connecting" && "bg-ink-muted",
              connection === "offline" && "bg-rust",
            )}
          />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {statusLabel}
        </span>
      </div>
      <p className="font-data text-[12px] text-ink-muted">
        Last updated:{" "}
        <span className="text-ink">{agoSec === null ? "—" : formatAgo(agoSec)}</span>
      </p>
      {activityLabel ? (
        <p className="text-[12px] text-ink-muted">{activityLabel}</p>
      ) : null}
    </div>
  );
}

export function RunwayRealtimeClient(props: RunwayViewProps) {
  const { connection, lastUpdatedAt, live } = useDashboardRealtime({
    metrics: ["emissions", "datapoints", "reports", "pending_approval"],
  });

  const totalEmissions = live.emissions ?? props.totalEmissions;
  const scope1 = live.scopes?.scope1 ?? props.scope1;
  const scope2 = live.scopes?.scope2 ?? props.scope2;
  const scope3 = live.scopes?.scope3 ?? props.scope3;
  const total = scope1 + scope2 + scope3;
  const s1Pct = total > 0 ? (scope1 / total) * 100 : props.s1Pct;
  const s2Pct = total > 0 ? (scope2 / total) * 100 : props.s2Pct;
  const s3Pct = total > 0 ? (scope3 / total) * 100 : props.s3Pct;
  const pendingApproval = live.pendingApproval ?? props.pendingApproval;

  const activityLabel =
    live.lastActivity?.kind === "datapoint" && live.lastActivity.metricKey
      ? `New datapoint: ${live.lastActivity.metricKey}`
      : live.lastActivity?.kind === "report"
        ? "Report updated"
        : null;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
      <LiveStatusBar
        connection={connection}
        lastUpdatedAt={lastUpdatedAt}
        activityLabel={activityLabel}
      />

      <RunwayMainHeader periodLabel={props.periodLabel} />

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4">
          <RunwayReadinessCard
            calm={props.calm}
            readiness={props.readiness}
            collected={props.collected}
            required={props.required}
            days={props.days}
            filingOverdue={props.filingOverdue}
            deadlineIso={props.deadlineIso}
            standardVersion={props.standardVersion}
            primaryAction={props.primaryAction}
            projectedMiss={props.projectedMiss}
          />
        </div>

        <div className="min-w-0 lg:col-span-8">
          <RunwayMetricsGrid
            days={props.days}
            filingOverdue={props.filingOverdue}
            coveragePct={props.coveragePct}
            pendingApproval={pendingApproval}
            assignedCount={props.assignedCount}
            overdueCount={props.overdueCount}
          />

          <RunwayActions
            actions={props.nextActions}
            approvalByMetric={props.approvalByMetric}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
          <RunwayEmissions
            totalEmissions={totalEmissions}
            scope1={scope1}
            scope2={scope2}
            scope3={scope3}
            s1Pct={s1Pct}
            s2Pct={s2Pct}
            s3Pct={s3Pct}
            hasScope3Composition={props.hasScope3Composition}
            primarySharePct={props.primarySharePct}
          />
        </div>
        <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
          <RunwayFiling
            days={props.days}
            filingOverdue={props.filingOverdue}
            deadlineIso={props.deadlineIso}
            standardVersion={props.standardVersion}
            derivationReason={props.derivationReason}
            projectedMiss={props.projectedMiss}
            secondary={props.secondary}
            hasObligation={props.hasObligation}
            obligationId={props.obligationId}
            canManage={props.canManage}
            needsConfirmation={props.needsConfirmation}
            baselineDrift={props.baselineDrift}
            obligationSource={props.obligationSource}
            baselineIncomplete={props.baselineIncomplete}
            missingCountry={props.missingCountry}
            missingHeadcount={props.missingHeadcount}
            missingRevenue={props.missingRevenue}
          />
        </div>
        <RunwayPeerCard peer={props.peerBenchmark} />
        <RunwayIntensityCard />
      </div>

      <RunwayAnomalies anomalies={props.anomalies} />
      <RunwayFooter />
    </div>
  );
}
