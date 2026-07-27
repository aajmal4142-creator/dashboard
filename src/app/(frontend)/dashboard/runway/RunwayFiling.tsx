import { InkReveal } from "@/components/motion";
import { Metric } from "@/components/ui/metric";

import { ObligationControls } from "../ObligationControls";
import { formatDeadline } from "./format";
import { GoLink } from "./GoLink";
import type { RunwaySecondaryObligation } from "./types";

type RunwayFilingProps = {
  days: number | null;
  filingOverdue: boolean;
  deadlineIso: string | null;
  standardVersion: string | null;
  derivationReason: string | null;
  projectedMiss: number;
  secondary: RunwaySecondaryObligation[];
  hasObligation: boolean;
  obligationId: string | null;
  canManage: boolean;
  needsConfirmation: boolean;
  baselineDrift: boolean;
  obligationSource: "engine" | "manual" | null;
  baselineIncomplete: boolean;
  missingCountry: boolean;
  missingHeadcount: boolean;
  missingRevenue: boolean;
};

export function RunwayFiling({
  days,
  filingOverdue,
  deadlineIso,
  standardVersion,
  derivationReason,
  projectedMiss,
  secondary,
  hasObligation,
  obligationId,
  canManage,
  needsConfirmation,
  baselineDrift,
  obligationSource,
  baselineIncomplete,
  missingCountry,
  missingHeadcount,
  missingRevenue,
}: RunwayFilingProps) {
  const title =
    days === null
      ? hasObligation && !deadlineIso
        ? "Not in mandatory scope"
        : "Confirm deadline"
      : (standardVersion ?? "Filing");

  const body =
    days === null
      ? baselineIncomplete
        ? "Complete the organisation baseline to derive a filing date."
        : (derivationReason ?? "You can still prepare evidence voluntarily.")
      : filingOverdue
        ? `Due ${formatDeadline(deadlineIso!)}. Finish next actions and publish.`
        : projectedMiss > 0
          ? "Collection pace puts the filing date at risk."
          : "Collection pace is on track for the filing date.";

  return (
    <InkReveal delay={0.16} className="min-w-0 lg:col-span-5">
      <p className="label-caps">Filing</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>

      {baselineIncomplete ? (
        <p className="mt-3 text-sm text-ink-muted">
          Missing
          {missingCountry ? " country" : null}
          {missingHeadcount ? " headcount" : null}
          {missingRevenue ? " revenue band" : null}.
        </p>
      ) : null}

      {baselineIncomplete ? (
        <GoLink href="/dashboard/onboarding" className="mt-2 text-xs">
          Open onboarding
        </GoLink>
      ) : null}

      {projectedMiss > 0 && !filingOverdue ? (
        <p className="mt-3 text-sm text-rust">
          Projected delay{" "}
          <Metric
            value={projectedMiss}
            unit="days"
            size="sm"
            decimals={0}
            tone="rust"
            className="inline-flex"
            inView={false}
          />
        </p>
      ) : null}

      {secondary.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-xs text-ink-muted">
          {secondary.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.standardVersion}</span>
              <span className="font-data text-ink">
                {item.filingDeadline
                  ? formatDeadline(item.filingDeadline)
                  : "No deadline"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {hasObligation && obligationId ? (
        <ObligationControls
          obligationId={obligationId}
          filingDeadline={deadlineIso}
          canManage={canManage}
          needsConfirmation={needsConfirmation}
          baselineDrift={baselineDrift}
          source={obligationSource}
        />
      ) : (
        <GoLink href="/dashboard/onboarding" className="mt-4 text-sm">
          Complete baseline
        </GoLink>
      )}

      {derivationReason ? (
        <details className="mt-4 border-t border-rule pt-3">
          <summary className="editorial-link cursor-pointer list-none text-xs [&::-webkit-details-marker]:hidden">
            Why this position?
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {derivationReason}
          </p>
        </details>
      ) : null}
    </InkReveal>
  );
}
