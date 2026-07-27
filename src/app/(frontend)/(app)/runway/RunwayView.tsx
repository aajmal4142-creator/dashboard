import { Assemble } from "@/components/motion";

import { RunwayActions } from "./RunwayActions";
import { RunwayAnomalies } from "./RunwayAnomalies";
import { RunwayEmissions } from "./RunwayEmissions";
import { RunwayFiling } from "./RunwayFiling";
import { RunwayFooter } from "./RunwayFooter";
import { RunwayMainHeader, RunwayMetricsGrid } from "./RunwayMetricsGrid";
import { RunwayReadinessCard } from "./RunwayReadinessRail";
import type { RunwayViewProps } from "./types";

export function RunwayView(props: RunwayViewProps) {
  return (
    <Assemble layer="structure" className="min-h-full bg-canvas">
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
        <Assemble layer="data">
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
                pendingApproval={props.pendingApproval}
                assignedCount={props.assignedCount}
                overdueCount={props.overdueCount}
              />

              <RunwayActions
                actions={props.nextActions}
                approvalByMetric={props.approvalByMetric}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
              <RunwayEmissions
                totalEmissions={props.totalEmissions}
                scope1={props.scope1}
                scope2={props.scope2}
                scope3={props.scope3}
                s1Pct={props.s1Pct}
                s2Pct={props.s2Pct}
                s3Pct={props.s3Pct}
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
          </div>

          <RunwayAnomalies anomalies={props.anomalies} />
          <RunwayFooter />
        </Assemble>
      </div>
    </Assemble>
  );
}
