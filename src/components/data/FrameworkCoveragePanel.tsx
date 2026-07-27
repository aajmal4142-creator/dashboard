"use client";

import { Metric } from "@/components/ui/metric";
import { FRAMEWORK_DISPLAY, type FrameworkCoverageSummary } from "@/lib/frameworks";

/**
 * Framework coverage strip above the Metrics table.
 * Satisfied never paints green for partial / contribute-only states.
 */
export function FrameworkCoveragePanel({
  summaries,
}: {
  summaries: FrameworkCoverageSummary[];
}) {
  if (summaries.length === 0) {
    return (
      <section className="w-full border-b border-rule pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
          Framework coverage
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          No applicable frameworks for this organisation yet.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full border-b border-rule pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
            Framework coverage
          </p>
          <p className="mt-1 max-w-[72ch] text-[12px] text-ink-muted">
            Satisfied requires honest measured or calculated data. Estimates count as
            partial — never complete.
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaries.map((s) => (
          <li key={s.framework} className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">
              {FRAMEWORK_DISPLAY[s.framework]}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              <p className="text-signal">
                Satisfied{" "}
                <Metric value={s.pctSatisfied} unit="%" size="sm" animate={false} />
              </p>
              <p className="text-amber">
                Partial <Metric value={s.pctPartial} unit="%" size="sm" animate={false} />
              </p>
              <p className="text-rust">
                Gap <Metric value={s.pctGap} unit="%" size="sm" animate={false} />
              </p>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              {s.satisfied} satisfied · {s.partial} partial · {s.gap} gap · {s.total}{" "}
              disclosures
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
